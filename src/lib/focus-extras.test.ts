import { beforeEach, describe, expect, it } from "vitest";
import { dayFocusMinutes, focusDestination, focusExpectedEnd, nextBusyAfter, recentIntentions, showRunningExtend, todaySummary, wakeLockWanted } from "./focus-extras";
import { breakTimer, elapsedMs, focusTimer, MAX_PARKED, type FocusState } from "./focus-timer";
import type { CalEvent } from "./timeline";

const ev = (id: string, start: string, extra: Partial<CalEvent> = {}): CalEvent => ({ id, title: id, start, end: start, allDay: false, source: "google", kind: "meeting", ...extra });

describe("Today active focus", () => {
  const start = new Date(2026, 9, 21, 9).getTime();
  const day = new Date(start);
  const active: FocusState = { id: "live", sessionStart: start, resumedAt: start, accumulatedMs: 0, targetMin: 50, intention: "", energyBefore: null, nextEventAt: null, interruptions: [], paused: false };
  it("returns to running and paused sessions instead of passing a new plan", () => {
    expect(focusDestination({ minutes: 90 }, active)).toEqual({ to: "/focus", search: {} });
    expect(focusDestination({ minutes: 90 }, { ...active, paused: true })).toEqual({ to: "/focus", search: {} });
    expect(focusDestination({ minutes: 90 }, null)).toEqual({ to: "/focus", search: { minutes: 90 } });
  });
  it("never replaces an existing timer on a second start action", () => {
    focusTimer.clear();
    focusTimer.start({ targetMin: 50, intention: "First", energyBefore: null, nextEventAt: null });
    const first = focusTimer.get();
    focusTimer.start({ targetMin: 90, intention: "Second", energyBefore: null, nextEventAt: null });
    expect(focusTimer.get()).toEqual(first);
    expect(focusTimer.get()?.targetMin).toBe(50);
    expect(focusDestination({ minutes: 90 })).toEqual({ to: "/focus", search: {} });
    focusTimer.clear();
  });
  it("adds live elapsed minutes and updates as time advances", () => {
    const saved = [{ id: "old", actual_min: 25 }];
    expect(dayFocusMinutes(saved, active, day, start + 7 * 60_000)).toBe(32);
    expect(dayFocusMinutes(saved, active, day, start + 8 * 60_000)).toBe(33);
    expect(dayFocusMinutes([], active, day, start + 7.6 * 60_000)).toBe(8);
  });
  it("excludes paused time, including time before the last resume", () => {
    const paused = { ...active, paused: true, accumulatedMs: 12 * 60_000 };
    expect(dayFocusMinutes([], paused, day, start + 40 * 60_000)).toBe(12);
    expect(dayFocusMinutes([], { ...paused, paused: false, resumedAt: start + 40 * 60_000 }, day, start + 43 * 60_000)).toBe(15);
  });
  it("counts saved/queued ids once and never adds an already saved active session", () => {
    const rows = [{ id: "live", actual_min: 8 }, { id: "live", actual_min: 8 }, { id: "old", actual_min: 25 }];
    expect(dayFocusMinutes(rows, active, day, start + 8 * 60_000)).toBe(33);
    expect(dayFocusMinutes(rows, null, day, start + 8 * 60_000)).toBe(33);
  });
  it("assigns active time to the local start day just like saved sessions", () => {
    const tomorrow = new Date(2026, 9, 22);
    expect(dayFocusMinutes([], active, tomorrow, start + 8 * 60_000)).toBe(0);
  });
  it("predicts the end from unpaused elapsed time", () => {
    expect(focusExpectedEnd({ ...active, accumulatedMs: 10 * 60_000, resumedAt: start + 20 * 60_000 }, start + 25 * 60_000).getTime()).toBe(start + 60 * 60_000);
  });
});

describe("F7 next meeting lookup", () => {
  const now = new Date("2026-10-15T10:00:00Z");
  it("picks the next timed busy event", () => {
    expect(nextBusyAfter([ev("b", "2026-10-15T13:00:00Z"), ev("a", "2026-10-15T11:00:00Z"), ev("past", "2026-10-15T09:00:00Z")], now)).toBe("2026-10-15T11:00:00Z");
  });
  it("ignores all-day events and focus blocks", () => {
    expect(nextBusyAfter([ev("d", "2026-10-15T10:30:00Z", { allDay: true }), ev("f", "2026-10-15T10:40:00Z", { kind: "focus" })], now)).toBeNull();
  });
});

describe("F11 intention chips", () => {
  it("returns the last 3 distinct intentions, newest first", () => {
    const rows = [
      { intention: "Report", started_at: "2026-10-15T09:00:00Z" },
      { intention: "report ", started_at: "2026-10-14T09:00:00Z" },
      { intention: "Deck", started_at: "2026-10-15T08:00:00Z" },
      { intention: null, started_at: "2026-10-15T11:00:00Z" },
      { intention: "Email", started_at: "2026-10-13T08:00:00Z" },
      { intention: "Old", started_at: "2026-10-01T08:00:00Z" },
    ];
    expect(recentIntentions(rows)).toEqual(["Report", "Deck", "Email"]);
  });
});

describe("F5 wake lock", () => {
  it("holds only when enabled, running, not paused and visible", () => {
    expect(wakeLockWanted(true, true, false, true)).toBe(true);
    expect(wakeLockWanted(false, true, false, true)).toBe(false);
    expect(wakeLockWanted(true, true, true, true)).toBe(false);
    expect(wakeLockWanted(true, false, false, true)).toBe(false);
  });
});

describe("F4 today summary", () => {
  it("counts sessions and minutes once each", () => {
    expect(todaySummary([{ id: "a", actual_min: 50 }, { id: "b", actual_min: 45 }, { id: "b", actual_min: 45 }])).toBe("2nd session · 1h 35m today");
  });
});

describe("timer extend, interruptions, parking, breaks", () => {
  beforeEach(() => { localStorage.clear(); focusTimer.clear(); breakTimer.clear(); });
  it("F9 shows +5 only in the last 5 minutes", () => {
    expect(showRunningExtend(5 * 60_000)).toBe(true);
    expect(showRunningExtend(5 * 60_000 + 1)).toBe(false);
    expect(showRunningExtend(0)).toBe(false);
  });
  it("extend adds minutes and re-arms the end signal", () => {
    focusTimer.start({ targetMin: 25, intention: "", energyBefore: null, nextEventAt: null });
    focusTimer.markSignalled();
    focusTimer.extend(5);
    expect(focusTimer.get()!.targetMin).toBe(30);
    expect(focusTimer.get()!.signalled).toBe(false);
  });
  it("F8 logging an interruption pauses the timer", () => {
    focusTimer.start({ targetMin: 25, intention: "", energyBefore: null, nextEventAt: null });
    focusTimer.interrupt("message", "external");
    const s = focusTimer.get()!;
    expect(s.paused).toBe(true);
    expect(s.interruptions[0]).toMatchObject({ reason: "message", source: "external" });
    expect(elapsedMs(s, Date.now() + 60_000)).toBe(s.accumulatedMs);
  });
  it("F13 parks up to 10 thoughts of 140 chars", () => {
    focusTimer.start({ targetMin: 25, intention: "", energyBefore: null, nextEventAt: null });
    for (let i = 0; i < 12; i++) focusTimer.park("x".repeat(200));
    expect(focusTimer.get()!.parked!.length).toBe(MAX_PARKED);
    expect(focusTimer.get()!.parked![0]!.length).toBe(140);
    expect(focusTimer.get()!.paused).toBe(false);
  });
  it("F10 break keeps the last length and isn't a focus session", () => {
    breakTimer.start(5, 50, 1000);
    expect(breakTimer.get()).toEqual({ endsAt: 1000 + 300_000, minutes: 5, lastLen: 50 });
    expect(focusTimer.get()).toBeNull();
  });
});
