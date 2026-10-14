import { useEffect, useRef, useState } from "react";

// Session dismissal is independent of query rollback and route remounts.
const dismissedUsers = new Set<string>();
const attemptedUsers = new Set<string>();
const pendingKey = (userId: string) => `tempo.safetyAck.pending.${userId}`;

function readPending(userId: string) {
  try {
    return localStorage.getItem(pendingKey(userId));
  } catch {
    return null;
  }
}

export function useSafetyAcknowledgement({
  userId,
  acknowledged,
  save,
}: {
  userId: string;
  acknowledged: boolean;
  save: (patch: { safety_ack_at: string }) => Promise<unknown>;
}) {
  const [dismissed, setDismissed] = useState(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  function dismiss() {
    dismissedUsers.add(userId);
    setDismissed(true);
  }

  async function persist(timestamp: string) {
    try {
      await saveRef.current({ safety_ack_at: timestamp });
      try {
        localStorage.removeItem(pendingKey(userId));
      } catch {
        // Storage can be unavailable; the saved acknowledgement is authoritative.
      }
    } catch {
      // The settings mutation reports the failure. Keep both session dismissal
      // and the pending explicit user action, rather than reopening the gate.
    }
  }

  useEffect(() => {
    if (dismissedUsers.has(userId)) setDismissed(true);
    const pending = readPending(userId);
    if (!pending) return;
    dismissedUsers.add(userId);
    setDismissed(true);
    if (attemptedUsers.has(userId)) return;
    attemptedUsers.add(userId);
    // Replay only a previously explicit acknowledgement, never computed data.
    void persist(pending);
    // One replay per user per launch, even if query updates remount the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function acknowledge() {
    dismiss();
    const timestamp = new Date().toISOString();
    attemptedUsers.add(userId);
    try {
      localStorage.setItem(pendingKey(userId), timestamp);
    } catch {
      // Unavailable storage must never prevent continuing this session.
    }
    void persist(timestamp);
  }

  return { open: !acknowledged && !dismissed, acknowledge };
}