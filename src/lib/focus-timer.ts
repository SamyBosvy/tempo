// Focus timer state lives in localStorage and is computed from timestamps,
// so refreshing, leaving or locking the phone never loses it.
import { useSyncExternalStore } from "react";

export type InterruptReason = "meeting" | "message" | "distracted" | "other" | "custom";
export type Interruption = { reason: InterruptReason; source?: "self" | "external" | undefined; customLabel?: string | null; at: string };
export const MAX_PARKED = 10;
export const PARKED_MAX_LEN = 140;
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
  /** Time is up and the user chose to carry on (counts up as +mm:ss). */
  overtime?: boolean;
  /** End signal (chime/vibration/notification) already fired for the current target. */
  signalled?: boolean;
  /** One-line thoughts parked during the session (max 10). */
  parked?: string[];
};

let KEY = "tempo.focus.v1";
export function setTimerUser(userId: string | null) {
  const next = `tempo.focus.v1.${userId ?? 'signed-out'}`;
  if (KEY === next) return;
  KEY = next;
  BKEY = `tempo.break.v1.${userId ?? 'signed-out'}`;
  cache = undefined; bcache = undefined;
  listeners.forEach(l => l());
}
const listeners = new Set<() => void>();
const mutations = new Set<(s: FocusState | null) => void>();
export function onFocusMutation(cb: (s: FocusState | null) => void) { mutations.add(cb); return () => { mutations.delete(cb); }; }
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
  mutations.forEach(cb => cb(s));
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
  /** Log an interruption and pause, so the interruption doesn't count as focus. */
  interrupt(reason: InterruptReason, source?: "self" | "external", customLabel?: string | null) {
    const s = read();
    if (!s) return;
    const now = Date.now();
    const entry: Interruption = { reason, source, customLabel: reason === "custom" ? (customLabel ?? "").slice(0, 30) : null, at: new Date(now).toISOString() };
    write({
      ...s,
      interruptions: [...s.interruptions, entry],
      ...(s.paused ? {} : { paused: true, accumulatedMs: elapsedMs(s, now) }),
    });
  },
  /** Park a thought without pausing. Returns false when full or empty. */
  park(text: string) {
    const s = read();
    const t = text.trim().slice(0, PARKED_MAX_LEN);
    if (!s || !t || (s.parked?.length ?? 0) >= MAX_PARKED) return false;
    write({ ...s, parked: [...(s.parked ?? []), t] });
    return true;
  },
  markSignalled() {
    const s = read();
    if (!s || s.signalled) return;
    write({ ...s, signalled: true });
  },
  /** Cap elapsed time (used by "adjust the time"). */
  setElapsedMin(min: number) {
    const s = read();
    if (!s) return;
    write({ ...s, paused: true, accumulatedMs: min * 60_000 });
  },
  /** Called when the countdown reaches zero, so the Finish screen opens only once. */
  markOvertime() {
    const s = read();
    if (!s || s.overtime) return;
    write({ ...s, overtime: true });
  },
  keepGoing() {
    const s = read();
    if (!s) return;
    write({ ...s, overtime: true, ...(s.paused ? { paused: false, resumedAt: Date.now() } : {}) });
  },
  /** Add minutes to the target; the countdown resumes and ends again at the new target. */
  extend(min: number) {
    const s = read();
    if (!s) return;
    const base = Math.max(s.targetMin, Math.ceil(elapsedMs(s) / 60_000));
    write({ ...s, targetMin: base + min, overtime: false, signalled: false, ...(s.paused ? { paused: false, resumedAt: Date.now() } : {}) });
  },
  clear() {
    write(null);
  },
};

/** Break timer: separate from focus, never logged. */
export type BreakState = { endsAt: number; minutes: number; lastLen: number };
let BKEY = "tempo.break.v1";
let bcache: BreakState | null | undefined;
function readBreak(): BreakState | null {
  if (typeof window === "undefined") return null;
  if (bcache === undefined) {
    try {
      bcache = JSON.parse(localStorage.getItem(BKEY) ?? "null");
    } catch {
      bcache = null;
    }
  }
  return bcache ?? null;
}
export const breakTimer = {
  get: readBreak,
  start(minutes: number, lastLen: number, now = Date.now()) {
    bcache = { endsAt: now + minutes * 60_000, minutes, lastLen };
    localStorage.setItem(BKEY, JSON.stringify(bcache));
    listeners.forEach((l) => l());
  },
  clear() {
    bcache = null;
    localStorage.removeItem(BKEY);
    listeners.forEach((l) => l());
  },
};
export function useBreakState() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readBreak,
    () => null,
  );
}

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
