import { describe, it, expect } from "vitest";
import { copyMondayToWeekdays, dayError, dayHours, resolveWorkHours, workWindow } from "./work-hours";
import { computeSlots, keywordMatch } from "./timeline";

const legacy = { work_start: "09:00:00", work_end: "17:30:00" };

describe("per-day work hours", () => {
  it("uses the stored hours for a weekday", () => {
    const s = { ...legacy, work_hours: { 2: { on: true, start: "07:00", end: "15:00" } } };
    expect(dayHours(s, 2)).toEqual({ on: true, start: "07:00", end: "15:00" });
  });
  it("falls back to work_start/work_end with Mon–Fri on and Sat–Sun off", () => {
    const h = resolveWorkHours({ ...legacy, work_hours: null });
    expect(h[1]).toEqual({ on: true, start: "09:00", end: "17:30" });
    expect(h[5]!.on).toBe(true);
    expect(h[6]!.on).toBe(false);
    expect(h[0]!.on).toBe(false);
  });
  it("falls back for a malformed day only", () => {
    const h = resolveWorkHours({ ...legacy, work_hours: { 3: { on: true, start: "8am", end: "18:00" }, 4: { on: false, start: "08:00", end: "18:00" } } });
    expect(h[3]).toEqual({ on: true, start: "09:00", end: "17:30" });
    expect(h[4]!.on).toBe(false);
  });
  it("rejects an end that is not after start, but not on a day off", () => {
    expect(dayError({ on: true, start: "10:00", end: "10:00" })).toMatch(/after start/);
    expect(dayError({ on: true, start: "10:00", end: "09:00" })).toMatch(/after start/);
    expect(dayError({ on: false, start: "10:00", end: "09:00" })).toBeNull();
    expect(dayError({ on: true, start: "08:00", end: "18:00" })).toBeNull();
  });
  it("copies Monday to Tue–Fri only", () => {
    const h = copyMondayToWeekdays(resolveWorkHours({ ...legacy, work_hours: { 1: { on: true, start: "07:30", end: "16:00" } } }));
    expect(h[5]).toEqual({ on: true, start: "07:30", end: "16:00" });
    expect(h[6]!.on).toBe(false);
  });
});

describe("day off in computeSlots", () => {
  it("a day off gives no focus windows", () => {
    const sat = new Date(2026, 9, 17); // Saturday
    const w = workWindow({ ...legacy, work_hours: null }, sat);
    expect(w.on).toBe(false);
    expect(computeSlots([], w.start, w.end, 25)).toEqual([]);
  });
  it("a working day uses that day's hours", () => {
    const tue = new Date(2026, 9, 13);
    const w = workWindow({ ...legacy, work_hours: { 2: { on: true, start: "10:00", end: "12:00" } } }, tue);
    const slots = computeSlots([], w.start, w.end, 25);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.minutes).toBe(120);
  });
});

describe("keyword match highlighting", () => {
  it("splits the title around the matching keyword, case-insensitive", () => {
    expect(keywordMatch("Quarterly Review with Sam", ["review"])).toEqual({ keyword: "review", before: "Quarterly ", match: "Review", after: " with Sam" });
  });
  it("picks the earliest match", () => {
    expect(keywordMatch("1:1 then interview", ["interview", "1:1"])!.keyword).toBe("1:1");
  });
  it("returns null when nothing matches or keywords are blank", () => {
    expect(keywordMatch("Standup", ["review", " "])).toBeNull();
  });
});
