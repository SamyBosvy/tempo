// One place for tap haptics. Very short (10ms) and only when the user's
// "Soft vibration" setting is on and the device supports navigator.vibrate.
let enabled = false;

/** Called by the app shell whenever settings load or change. */
export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

/** Fire a short tap vibration on a primary action. No-op when off/unsupported. */
export function tapHaptic() {
  if (!enabled) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(10);
  } catch {
    // some browsers throw; haptics are best-effort
  }
}
