export type BreathPattern = "sigh" | "box" | "478";
export type Phase = { label: string; seconds: number; scale: number };

export const PATTERNS: Record<BreathPattern, { name: string; blurb: string; phases: Phase[] }> = {
  sigh: {
    name: "Physiological sigh",
    blurb: "Two inhales through the nose, one long exhale.",
    phases: [
      { label: "Inhale", seconds: 2, scale: 0.8 },
      { label: "Top up", seconds: 1, scale: 1 },
      { label: "Long exhale", seconds: 6, scale: 0.4 },
    ],
  },
  box: {
    name: "Box breathing",
    blurb: "Four in, hold four, four out, hold four.",
    phases: [
      { label: "Inhale", seconds: 4, scale: 1 },
      { label: "Hold", seconds: 4, scale: 1 },
      { label: "Exhale", seconds: 4, scale: 0.4 },
      { label: "Hold", seconds: 4, scale: 0.4 },
    ],
  },
  "478": {
    name: "4-7-8",
    blurb: "Four in, hold seven, eight out.",
    phases: [
      { label: "Inhale", seconds: 4, scale: 1 },
      { label: "Hold", seconds: 7, scale: 1 },
      { label: "Exhale", seconds: 8, scale: 0.4 },
    ],
  },
};

export function phaseAt(pattern: BreathPattern, elapsedS: number) {
  const phases = PATTERNS[pattern].phases;
  const cycle = phases.reduce((a, p) => a + p.seconds, 0);
  let t = elapsedS % cycle;
  for (let i = 0; i < phases.length; i++) {
    const ph = phases[i]!;
    if (t < ph.seconds) return { index: i, phase: ph, remaining: ph.seconds - t };
    t -= ph.seconds;
  }
  return { index: 0, phase: phases[0]!, remaining: phases[0]!.seconds };
}
