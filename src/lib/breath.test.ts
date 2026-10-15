import { describe, expect, it } from "vitest";
import { PATTERNS, phaseAt, phaseHaptics } from "./breath";
import { DEFAULT_SETTINGS } from "./settings";

describe("Prime timing", () => {
  it("keeps the sigh's two inhales and six-second exhale", () => {
    expect(PATTERNS.sigh.phases.map((p) => p.seconds)).toEqual([2, 1, 6]);
    expect(phaseAt("sigh", 2).phase.label).toBe("Top up");
    expect(phaseAt("sigh", 3).phase.kind).toBe("exhale");
    expect(phaseAt("sigh", 9).index).toBe(0);
  });
  it("keeps four-second box phases and sweeps both holds at their correct sizes", () => {
    expect(PATTERNS.box.phases.map((p) => p.seconds)).toEqual([4, 4, 4, 4]);
    const highHold = phaseAt("box", 6);
    expect(highHold.phase.kind).toBe("hold");
    expect(highHold.progress).toBe(0.5);
    expect(highHold.remaining).toBe(2);
    expect(highHold.fromScale).toBe(1);
    expect(highHold.phase.scale).toBe(1);
    const lowHold = phaseAt("box", 12);
    expect(lowHold.phase.kind).toBe("hold");
    expect(lowHold.fromScale).toBe(0.4);
    expect(lowHold.phase.scale).toBe(0.4);
  });
  it("keeps 4-7-8 boundaries", () => {
    expect(PATTERNS["478"].phases.map((p) => p.seconds)).toEqual([4, 7, 8]);
    expect(phaseAt("478", 4).phase.kind).toBe("hold");
    expect(phaseAt("478", 11).phase.kind).toBe("exhale");
    expect(phaseAt("478", 19).phase.kind).toBe("inhale");
  });
  it("wraps the next-phase cue and distinguishes successive cycles", () => {
    const final = phaseAt("box", 15);
    expect(final.nextIndex).toBe(0);
    expect(final.nextPhase.kind).toBe("inhale");
    expect(phaseAt("box", 16).occurrence).toBe(4);
    expect(phaseAt("box", 0).fromScale).toBe(0.4);
    expect(phaseAt("sigh", 2).nextPhase.label).toBe("Long exhale");
  });
  it("handles invalid elapsed values without skipping the first phase", () => {
    expect(phaseAt("sigh", -1).progress).toBe(0);
    expect(phaseAt("sigh", Infinity).index).toBe(0);
  });
  it("uses distinct haptic cues for inhale, hold and exhale", () => {
    expect(phaseHaptics("inhale")).toEqual([180]);
    expect(phaseHaptics("hold")).toEqual([40, 90, 40]);
    expect(phaseHaptics("exhale")).toEqual([160, 60, 100, 60, 40]);
  });
  it("defaults eyes-closed mode to off", () => {
    expect(DEFAULT_SETTINGS.eyes_closed).toBe(false);
  });
});