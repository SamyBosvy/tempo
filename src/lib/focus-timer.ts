// Focus timer state lives in localStorage and is computed from timestamps,
// so refreshing, leaving or locking the phone never loses it.
import { useSyncExternalStore } from "react";

export type Interruption = { reason: "meeting" | "message" | "distracted" | "other"; at: string };
export type FocusState = {
  id: string;
  targetMin: number;
  sessionStart: number; // first start, ms
  resumedAt: number; // last resume, ms
  accumulatedMs: number;
  paused: boolean;
  intention: string;
  energyBefore: number | null;
  interruptions: Interruption[];
  /** Next calendar event start in this window (ISO), for the wrap-up warning. */
  nextEventAt: string | null;
};

const KEY = "tempo.focus.v1";
const listeners = new Set<() => void>();
let cache: FocusState | null | undefined;

function read(): FocusState | null {
  if (typeof window === "undefined") return null;
  if (cache === undefined) {
    try {
      cache = JSON.parse(localStorage.getItem(KEY) ?? "null");
    } catch {
      cache = null;
    }
  }
  return cache ?? null;
}
function write(s: FocusState | null) {
  cache = s;
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      cache = undefined;
      listeners.forEach((l) => l());
    }
  });
}

export function elapsedMs(s: FocusState, now = Date.now()) {
  return s.accumulatedMs + (s.paused ? 0 : now - s.resumedAt);
}

export const focusTimer = {
  get: read,
  start(p: { targetMin: number; intention: string; energyBefore: number | null; nextEventAt: string | null }) {
    if (read()) return;
    const now = Date.now();
    write({
      id: crypto.randomUUID(),
      sessionStart: now,
      resumedAt: now,
      accumulatedMs: 0,
      paused: false,
      interruptions: [],
      ...p,
    });
  },
  pause() {
    const s = read();
    if (!s || s.paused) return;
    write({ ...s, paused: true, accumulatedMs: elapsedMs(s) });
  },
  resume() {
    const s = read();
    if (!s || !s.paused) return;
    write({ ...s, paused: false, resumedAt: Date.now() });
  },
  interrupt(reason: Interruption["reason"]) {
    const s = read();
    if (!s) return;
    write({ ...s, interruptions: [...s.interruptions, { reason, at: new Date().toISOString() }] });
  },
  /** Cap elapsed time (used by "adjust the time"). */
  setElapsedMin(min: number) {
    const s = read();
    if (!s) return;
    write({ ...s, paused: true, accumulatedMs: min * 60_000 });
  },
  clear() {
    write(null);
  },
};

export function useFocusState() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => null,
  );
}
