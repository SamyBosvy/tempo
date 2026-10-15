import { beforeEach, describe, expect, it } from "vitest";
import { clearPrime, isStalePrime, loadPrime, primeProgress, savePrime, type RunningPrime } from "./prime-session";
import { PATTERNS, phaseAt } from "./breath";
import { afterMeetingRating, primeIntents } from "./checkin";

const base: RunningPrime = { pattern: "box", minutes: 2, startedAt: 1_000_000, event: "e1", at: null, quick: false };

describe("P6 resume from timestamp", () => {
  beforeEach(() => localStorage.clear());
  it("resumes at the right phase after the tab was hidden", () => {
    savePrime(base);
    const p = loadPrime()!;
    const prog = primeProgress(p, base.startedAt + 22_000);
    expect(prog.done).toBe(false);
    expect(prog.elapsed).toBe(22);
    expect(phaseAt(p.pattern, prog.elapsed).phase.label).toBe("Hold"); // 16+4 inhale → hold at 20–24
  });
  it("shows Settled once the length has passed", () => {
    expect(primeProgress(base, base.startedAt + 121_000)).toEqual({ elapsed: 120, done: true });
  });
  it("stops at Finish early", () => {
    expect(primeProgress({ ...base, endedAt: base.startedAt + 30_000 }, base.startedAt + 90_000)).toEqual({ elapsed: 30, done: true });
  });
  it("clears and rejects bad or stale state", () => {
    savePrime(base); clearPrime(); expect(loadPrime()).toBeNull();
    localStorage.setItem("tempo.prime.v1", JSON.stringify({ ...base, pattern: "nope" }));
    expect(loadPrime()).toBeNull();
    expect(isStalePrime(base, base.startedAt + 25 * 3600_000)).toBe(true);
  });
});

describe("P10 new patterns", () => {
  it("coherent is 5.5 in / 5.5 out", () => {
    expect(PATTERNS.coherent.phases.map((p) => [p.kind, p.seconds])).toEqual([["inhale", 5.5], ["exhale", 5.5]]);
    expect(phaseAt("coherent", 5.4).phase.kind).toBe("inhale");
    expect(phaseAt("coherent", 5.5).phase.kind).toBe("exhale");
    expect(phaseAt("coherent", 11).index).toBe(0);
  });
  it("extended exhale is 4 in / 8 out", () => {
    expect(PATTERNS.extended.phases.map((p) => [p.kind, p.seconds])).toEqual([["inhale", 4], ["exhale", 8]]);
    expect(phaseAt("extended", 4).phase.kind).toBe("exhale");
    expect(phaseAt("extended", 11).nextPhase.kind).toBe("inhale");
  });
});

describe("P9 outcome saving", () => {
  const o = { id: "r", rating: 4, eventId: "e1", dayKey: "2026-10-15", at: "x" };
  it("keeps the outcome for a primed meeting with an intention", () => {
    expect(afterMeetingRating({ ...o, primed: true, intention: "Agree budget", outcome: "partly" }).intent_outcome).toBe("partly");
  });
  it("drops the outcome without a prime intention", () => {
    expect(afterMeetingRating({ ...o, primed: true, intention: null, outcome: "yes" }).intent_outcome).toBeNull();
    expect(afterMeetingRating({ ...o, primed: false, intention: "x", outcome: "yes" }).intent_outcome).toBeNull();
  });
  it("uses the latest written intention per meeting", () => {
    const m = primeIntents([{ event_id: "e1", intention: "first", at: "1" }, { event_id: "e1", intention: "second", at: "2" }, { event_id: null, intention: "q", at: "3" }]);
    expect(m.get("e1")).toBe("second");
    expect(m.size).toBe(1);
  });
});
