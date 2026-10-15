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

import { backToBackRun, expandRecurring, ribbonSegments } from "./timeline";

describe("meeting buffer", () => {
  it("focus windows start after the buffer", () => {
    const slots = computeSlots([ev("a", at(9), at(10))], at(8), at(18), 25, undefined, 5);
    expect(slots.map((s) => s.start.getHours() * 60 + s.start.getMinutes())).toEqual([480, 605]);
    expect(slots[1]!.minutes).toBe(475);
  });
  it("buffer 0 keeps windows right after meetings", () => {
    const slots = computeSlots([ev("a", at(9), at(10))], at(8), at(18), 25, undefined, 0);
    expect(slots[1]!.start.getTime()).toBe(at(10).getTime());
  });
  it("buffer applies when now is just after a meeting", () => {
    const slots = computeSlots([ev("a", at(9), at(10))], at(8), at(18), 25, at(10, 2), 10);
    expect(slots[0]!.start.getTime()).toBe(at(10, 10).getTime());
  });
});

describe("recurring blocks", () => {
  const block = { id: "r1", kind: "meeting", label: "School run", start_time: "08:30:00", end_time: "09:00:00", days: [1, 2, 3, 4, 5], active: true };
  it("expands on a weekday", () => {
    const wed = new Date(2026, 9, 14); // Wednesday
    const out = expandRecurring([block], [], wed);
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toBe("School run");
    expect(new Date(out[0]!.start).getHours()).toBe(8);
  });
  it("does not occur on Saturday", () => expect(expandRecurring([block], [], new Date(2026, 9, 17))).toHaveLength(0));
  it("skips 'this day only'", () => expect(expandRecurring([block], [{ block_id: "r1", local_date: "2026-10-14" }], new Date(2026, 9, 14))).toHaveLength(0));
  it("inactive blocks never occur", () => expect(expandRecurring([{ ...block, active: false }], [], new Date(2026, 9, 14))).toHaveLength(0));
});

describe("back-to-back", () => {
  const evs = [ev("a", at(10), at(10, 30)), ev("b", at(10, 35), at(11)), ev("c", at(11, 5), at(12))];
  it("finds 3 blocks with gaps under 10 minutes", () => {
    const run = backToBackRun(evs, at(8), at(18), at(9));
    expect(run?.count).toBe(3);
    expect(run?.end.getTime()).toBe(at(12).getTime());
  });
  it("a 10-minute gap breaks the run", () => {
    expect(backToBackRun([evs[0]!, evs[1]!, ev("c", at(11, 10), at(12))], at(8), at(18), at(9))).toBeNull();
  });
  it("ignores runs that have finished", () => expect(backToBackRun(evs, at(8), at(18), at(12, 1))).toBeNull());
});

describe("ribbon", () => {
  it("places a meeting as a fraction of the work day", () => {
    const segs = ribbonSegments([{ ...ev("a", at(13), at(14)), stressful: true }], [], at(8), at(18));
    expect(segs[0]!.kind).toBe("stressful");
    expect(segs[0]!.x).toBeCloseTo(0.5);
    expect(segs[0]!.w).toBeCloseTo(0.1);
  });
});
