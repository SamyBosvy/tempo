import { describe, it, expect } from "vitest";
import { computeSlots, sessionLengthForWindow, matchesKeywords, fmtDuration, type CalEvent } from "./timeline";

const day = new Date(2026, 9, 14);
const at = (h: number, m = 0) => new Date(2026, 9, 14, h, m);
const ev = (id: string, s: Date, e: Date, allDay = false): CalEvent => ({
  id, title: id, start: s.toISOString(), end: e.toISOString(), allDay, source: "google",
});

describe("focus windows", () => {
  it("only slots of at least the minimum length are focus windows", () => {
    const slots = computeSlots([ev("a", at(9), at(9, 40)), ev("b", at(10), at(12))], at(8), at(18), 25);
    // 08:00-09:00 (60), 09:40-10:00 (20), 12:00-18:00 (360)
    expect(slots.map((s) => s.minutes)).toEqual([60, 20, 360]);
    expect(slots.map((s) => s.isWindow)).toEqual([true, false, true]);
  });
  it("marks the longest window as best", () => {
    const slots = computeSlots([ev("a", at(9), at(17))], at(8), at(18), 25);
    expect(slots.find((s) => s.best)?.minutes).toBe(60);
  });
  it("ignores all-day events", () => {
    const slots = computeSlots([ev("x", day, new Date(2026, 9, 15), true)], at(8), at(18), 25);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.minutes).toBe(600);
  });
  it("session ends 5 minutes before the next event", () => {
    const s = computeSlots([ev("a", at(10), at(11))], at(8), at(18), 25)[0]!;
    expect(sessionLengthForWindow(s, at(8))).toBe(115);
  });
});

describe("keywords and formatting", () => {
  it("matches keywords case-insensitively", () => {
    expect(matchesKeywords("Quarterly Performance chat", ["performance"])).toBe(true);
    expect(matchesKeywords("Lunch", ["review"])).toBe(false);
  });
  it("formats durations", () => {
    expect(fmtDuration(100)).toBe("1h 40m");
  });
});
