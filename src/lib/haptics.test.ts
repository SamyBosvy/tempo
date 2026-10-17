import { afterEach, describe, expect, it, vi } from "vitest";
import { setHapticsEnabled, tapHaptic } from "./haptics";

afterEach(() => {
  setHapticsEnabled(false);
  vi.restoreAllMocks();
});

describe("tapHaptic", () => {
  it("vibrates 10ms when the setting is on and vibration is supported", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    setHapticsEnabled(true);
    tapHaptic();
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it("does nothing when the setting is off", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    setHapticsEnabled(false);
    tapHaptic();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("does nothing when vibration is unsupported", () => {
    Object.defineProperty(navigator, "vibrate", { value: undefined, configurable: true });
    setHapticsEnabled(true);
    expect(() => tapHaptic()).not.toThrow();
  });

  it("never throws when the browser rejects the call", () => {
    Object.defineProperty(navigator, "vibrate", {
      value: () => { throw new Error("denied"); },
      configurable: true,
    });
    setHapticsEnabled(true);
    expect(() => tapHaptic()).not.toThrow();
  });
});
