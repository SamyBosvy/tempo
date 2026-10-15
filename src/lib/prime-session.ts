// P6: the running prime lives in localStorage and is computed from timestamps,
// like the focus timer, so a locked phone or hidden tab never loses the phase.
import { isBreathPattern, type BreathPattern } from "./breath";

export const PRIME_KEY = "tempo.prime.v1";
export const QUICK_PRIME_MIN = 1;

export type RunningPrime = {
  pattern: BreathPattern;
  minutes: number;
  startedAt: number;
  event: string | null;
  at: string | null;
  quick: boolean;
  /** Set by "Finish early"; elapsed stops there. */
  endedAt?: number;
};

export function loadPrime(): RunningPrime | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const v = JSON.parse(localStorage.getItem(PRIME_KEY) ?? "null") as RunningPrime | null;
    if (!v || !isBreathPattern(v.pattern) || !Number.isFinite(v.startedAt) || !(v.minutes >= 1 && v.minutes <= 5)) return null;
    return v;
  } catch {
    return null;
  }
}

export function savePrime(p: RunningPrime) {
  try { localStorage.setItem(PRIME_KEY, JSON.stringify(p)); } catch { /* storage full or blocked */ }
}

export function clearPrime() {
  try { localStorage.removeItem(PRIME_KEY); } catch { /* blocked */ }
}

/** Elapsed seconds (capped at the length) and whether the prime is over. */
export function primeProgress(p: RunningPrime, now: number) {
  const total = p.minutes * 60;
  const end = p.endedAt ?? now;
  const elapsed = Math.min(total, Math.max(0, (end - p.startedAt) / 1000));
  return { elapsed, done: p.endedAt !== undefined || elapsed >= total };
}

/** Stale primes (older than a day) are discarded rather than resumed. */
export function isStalePrime(p: RunningPrime, now: number) {
  return now - p.startedAt > 24 * 3600_000;
}
