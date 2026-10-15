import { phaseHaptics, type PhaseKind } from "./breath";

/** Browser-only effects, created on Begin, never during rendering. */
export class BreathCues {
  private context: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private active = true;

  constructor(private readonly sound: boolean, private readonly haptics: boolean) {
    if (!sound) return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.context = new AC();
      this.oscillator = this.context.createOscillator();
      this.gain = this.context.createGain();
      this.oscillator.type = "sine";
      this.gain.gain.value = 0;
      this.oscillator.connect(this.gain).connect(this.context.destination);
      this.oscillator.start();
      void this.context.resume().catch(() => this.stop());
    } catch {
      this.stop();
    }
  }

  phase(kind: PhaseKind, remaining: number) {
    if (!this.active || document.visibilityState === "hidden") return;
    if (this.haptics) {
      try { navigator.vibrate?.(this.sound ? phaseHaptics(kind) : 40); } catch { /* unsupported */ }
    }
    const ctx = this.context;
    const oscillator = this.oscillator;
    const gain = this.gain;
    if (!ctx || !oscillator || !gain) return;
    const now = ctx.currentTime;
    const duration = Math.max(0.05, remaining);
    const frequency = oscillator.frequency;
    frequency.cancelScheduledValues(now);
    frequency.setValueAtTime(kind === "exhale" ? 330 : kind === "hold" ? 330 : 220, now);
    frequency.linearRampToValueAtTime(kind === "inhale" ? 330 : kind === "exhale" ? 220 : 330, now + duration);
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(kind === "hold" ? 0.008 : 0.025, now + Math.min(0.08, duration / 4));
    gain.gain.linearRampToValueAtTime(0, now + duration);
  }

  stop() {
    this.active = false;
    try { navigator.vibrate?.(0); } catch { /* unsupported */ }
    if (this.gain) this.gain.gain.value = 0;
    try { this.oscillator?.stop(); } catch { /* already stopped */ }
    this.oscillator?.disconnect();
    this.gain?.disconnect();
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
    this.oscillator = null;
    this.gain = null;
  }
}