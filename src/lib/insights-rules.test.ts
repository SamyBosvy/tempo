import { describe, it, expect } from "vitest";
import {
  bestHour,
  primedDifference,
  weeklySuggestion,
  highMeetingLoad,
  meetingDays,
  meetingWeeks,
  mondayKey,
} from "./insights-rules";
describe("Insights evidence rules", () => {
  it("best hour requires three sessions with after energy", () => {
    expect(bestHour([{ hour: 9, minutes: 100, count: 3, energy_n: 2, avg_energy: 5 }])).toBeNull();
    expect(
      bestHour([{ hour: 9, minutes: 100, count: 3, energy_n: 3, avg_energy: 4.1 }])?.hour,
    ).toBe(9);
  });
  it("compares only three primed and three not", () => {
    expect(
      primedDifference({ primed_n: 2, unprimed_n: 3, primed_avg: 4, unprimed_avg: 3 }),
    ).toBeNull();
    expect(
      primedDifference({ primed_n: 3, unprimed_n: 3, primed_avg: 4, unprimed_avg: 3.2 }),
    ).toBeCloseTo(0.8);
  });
  it("high load requires over 60% three weeks running", () => {
    expect(highMeetingLoad([{ load: 61 }, { load: 60 }, { load: 70 }])).toBe(false);
    expect(highMeetingLoad([{ load: 61 }, { load: 65 }, { load: 70 }])).toBe(true);
  });
  it("suggests protecting Tuesday and Thursday with enough evidence", () => {
    expect(
      weeklySuggestion({ hour: 9, minutes: 90, count: 3, energy_n: 3, avg_energy: 4.1 }, 30, null),
    ).toContain("Tuesday and Thursday");
  });
  it("prioritises breathing room at high meeting load", () => {
    expect(weeklySuggestion(null, 61, null)).toBe(
      "Leave a little space between meetings next week.",
    );
  });
  it("suggests silencing messages only with three interruptions", () => {
    expect(
      weeklySuggestion(null, null, { reason: "message", label: null, count: 3, self: 2 }),
    ).toBe("Try silencing messages during your next focus block.");
    expect(
      weeklySuggestion(null, null, { reason: "message", label: null, count: 2, self: 2 }),
    ).not.toContain("silencing");
  });
  it("fills zero days and merges overlap, excludes all-day", () => {
    const events = [
      {
        id: "a",
        title: "Busy",
        start: "2026-10-12T09:00:00",
        end: "2026-10-12T10:00:00",
        allDay: false,
        source: "google" as const,
      },
      {
        id: "b",
        title: "Busy",
        start: "2026-10-12T09:30:00",
        end: "2026-10-12T10:30:00",
        allDay: false,
        source: "google" as const,
      },
    ];
    const days = meetingDays(events, "2026-10-12", "2026-10-13", () => ({ on: true, start: "08:00", end: "18:00" }));
    expect(days.map((x) => x.minutes)).toEqual([90, 0]);
    expect(meetingWeeks(days)[0]?.load).toBe(7.5);
  });
  it("week dismissal uses local Monday", () =>
    expect(mondayKey(new Date(2026, 9, 18, 23))).toBe("2026-10-12"));
});
