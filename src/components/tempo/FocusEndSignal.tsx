import { claimNotification } from "@/lib/push";
import { reminderKey } from "@/lib/push-rules";
// F5 + F6: keeps the screen awake during focus and fires the end signal
// (chime, vibration, notification) once when time is up, while Tempo is alive.
import { useEffect } from "react";
import { useFocusState, focusTimer, elapsedMs } from "@/lib/focus-timer";
import { playChime, useWakeLock, vibrateEnd, wakeLockWanted } from "@/lib/focus-extras";
import { showAppNotification } from "@/lib/notify";
import type { Settings } from "@/lib/settings";

export function FocusEndSignal({ settings }: { settings: Settings }) {
  const s = useFocusState();
  // The hook re-acquires on visibilitychange, so visibility is handled there.
  useWakeLock(wakeLockWanted(settings.wake_lock, !!s, !!s?.paused, true));

  useEffect(() => {
    if (!s || s.paused || s.signalled || s.overtime) return;
    const remaining = s.targetMin * 60_000 - elapsedMs(s);
    const fire = () => {
      const cur = focusTimer.get();
      if (!cur || cur.signalled || cur.paused) return;
      const late = elapsedMs(cur) - cur.targetMin * 60_000 > 2 * 60_000;
      focusTimer.markSignalled();
      if (late) return; // returned long after the end: just show the end state
      if (settings.end_sound) playChime();
      if (settings.vibration) vibrateEnd();
      if (settings.end_notify) void (async () => {
        const end = new Date(cur.resumedAt + cur.targetMin * 60_000 - cur.accumulatedMs).toISOString();
        if (settings.push_enabled && !await claimNotification(reminderKey('focus',cur.id,end))) return;
        await showAppNotification(`Focus done · ${cur.targetMin} min`, { body: "Time's up. Wrap up when you're ready.", tag: `focus-${cur.id}`, url: "/focus" });
      })();
    };
    if (remaining <= 0) {
      fire();
      return;
    }
    const t = window.setTimeout(fire, remaining);
    return () => window.clearTimeout(t);
  }, [s, settings.end_sound, settings.end_notify, settings.vibration, settings.push_enabled]);
  return null;
}
