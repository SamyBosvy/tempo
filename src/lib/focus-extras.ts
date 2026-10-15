// Focus-tab helpers: pure rules (tested) plus small browser effects
// (wake lock, chime, vibration). Browser bits skip silently where unsupported.
import { useEffect } from "react";
import type { CalEvent } from "./timeline";

/** F7: next timed busy event starting after `now` (all-day and focus blocks ignored). */
export function nextBusyAfter(events: CalEvent[], now: Date): string | null {
  const t = now.getTime();
  const next = events
    .filter((e) => !e.allDay && e.kind !== "focus" && new Date(e.start).getTime() > t)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  return next ? next.start : null;
}

/** F11: last `n` distinct intentions, newest first (case-insensitive). */
export function recentIntentions(rows: { intention: string | null; started_at: string }[], n = 3): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of [...rows].sort((a, b) => b.started_at.localeCompare(a.started_at))) {
    const t = r.intention?.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length === n) break;
  }
  return out;
}

/** F5: hold the screen awake only when enabled, a session runs (not paused) and the page is visible. */
export function wakeLockWanted(enabled: boolean, running: boolean, paused: boolean, visible: boolean) {
  return enabled && running && !paused && visible;
}

/** F9: the running-screen "+5 min" shows during the last 5 minutes only. */
export function showRunningExtend(remainingMs: number) {
  return remainingMs > 0 && remainingMs <= 5 * 60_000;
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** F4: "2nd session · 1h 35m today" from today's sessions (server + pending). */
export function todaySummary(sessions: { id: string; actual_min: number }[]) {
  const uniq = new Map(sessions.map((s) => [s.id, s.actual_min]));
  const total = [...uniq.values()].reduce((a, b) => a + b, 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const dur = h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  return `${ordinal(uniq.size)} session · ${dur} today`;
}

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const l = await (navigator as unknown as { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
        if (cancelled) void l.release();
        else lock = l;
      } catch {
        /* unsupported or denied: skip silently */
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

/** Soft two-note chime, generated (no file). */
export function playChime() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.35;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 1.5);
    });
    window.setTimeout(() => void ctx.close().catch(() => undefined), 2500);
  } catch {
    /* no audio */
  }
}

export function vibrateEnd() {
  try {
    navigator.vibrate?.([200, 120, 200, 120, 400]);
  } catch {
    /* unsupported */
  }
}
