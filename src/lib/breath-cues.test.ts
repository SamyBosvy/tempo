import { afterEach, describe, expect, it, vi } from "vitest";
import { BreathCues } from "./breath-cues";

afterEach(() => vi.unstubAllGlobals());

describe("Prime audio lifecycle", () => {
  it("creates and resumes on Begin and silences, cancels haptics and closes on stop", () => {
    const parameter = () => ({ value: 0, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
    const gain = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() };
    const oscillator = { type: "", frequency: parameter(), connect: vi.fn(() => gain), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
    const context = { currentTime: 0, destination: {}, createOscillator: () => oscillator, createGain: () => gain, resume: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal("AudioContext", vi.fn(function () { return context; }));
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    const cues = new BreathCues(true, true);
    expect(context.resume).toHaveBeenCalledOnce();
    cues.phase("inhale", 4);
    expect(oscillator.frequency.linearRampToValueAtTime).toHaveBeenCalledWith(330, 4);
    cues.stop();
    expect(gain.gain.value).toBe(0);
    expect(oscillator.stop).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
    expect(vibrate).toHaveBeenLastCalledWith(0);
    cues.phase("hold", 4);
    expect(vibrate).toHaveBeenLastCalledWith(0);
  });
  it("never constructs audio when eyes-closed mode is off", () => {
    const AC = vi.fn();
    vi.stubGlobal("AudioContext", AC);
    const cues = new BreathCues(false, false);
    cues.stop();
    expect(AC).not.toHaveBeenCalled();
  });
});