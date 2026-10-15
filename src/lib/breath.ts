export type BreathPattern = "sigh" | "box" | "478";
export type PhaseKind = "inhale" | "hold" | "exhale";
export type Phase = { label: string; seconds: number; scale: number; kind: PhaseKind };

export const PATTERNS: Record<BreathPattern, { name: string; blurb: string; phases: Phase[] }> = {
  sigh: {
    name: "Physiological sigh",
    blurb: "Two inhales through the nose, one long exhale.",
    phases: [
      { label: "Inhale", seconds: 2, scale: 0.8, kind: "inhale" },
      { label: "Top up", seconds: 1, scale: 1, kind: "inhale" },
      { label: "Long exhale", seconds: 6, scale: 0.4, kind: "exhale" },
    ],
  },
  box: {
    name: "Box breathing",
    blurb: "Four in, hold four, four out, hold four.",
    phases: [
      { label: "Inhale", seconds: 4, scale: 1, kind: "inhale" },
      { label: "Hold", seconds: 4, scale: 1, kind: "hold" },
      { label: "Exhale", seconds: 4, scale: 0.4, kind: "exhale" },
      { label: "Hold", seconds: 4, scale: 0.4, kind: "hold" },
    ],
  },
  "478": {
    name: "4-7-8",
    blurb: "Four in, hold seven, eight out.",
    phases: [
      { label: "Inhale", seconds: 4, scale: 1, kind: "inhale" },
      { label: "Hold", seconds: 7, scale: 1, kind: "hold" },
      { label: "Exhale", seconds: 8, scale: 0.4, kind: "exhale" },
    ],
  },
};

export function phaseAt(pattern: BreathPattern, elapsedS: number) {
  const phases = PATTERNS[pattern].phases;
  const cycle = phases.reduce((a, p) => a + p.seconds, 0);
  const elapsed = Number.isFinite(elapsedS) ? Math.max(0, elapsedS) : 0;
  let t = elapsed % cycle;
  for (let i = 0; i < phases.length; i++) {
    const ph = phases[i];
    if (!ph) continue;
    if (t < ph.seconds) {
      const nextIndex = (i + 1) % phases.length;
      const previous = phases[(i + phases.length - 1) % phases.length];
      return {
        index: i, phase: ph, remaining: ph.seconds - t, progress: t / ph.seconds,
        nextIndex, nextPhase: phases[nextIndex] ?? ph,
        fromScale: previous?.scale ?? ph.scale,
        occurrence: Math.floor(elapsed / cycle) * phases.length + i,
      };
    }
    t -= ph.seconds;
  }
  // All built-in patterns contain positive-duration phases.
  throw new Error("Breathing pattern has no timed phases");
}

export function phaseHaptics(kind: PhaseKind): number[] {
  if (kind === "inhale") return [180];
  if (kind === "hold") return [40, 90, 40];
  // Vibration APIs cannot vary intensity; decreasing pulses suggest a fade.
  return [160, 60, 100, 60, 40];
}
