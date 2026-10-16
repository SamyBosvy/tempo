import { atLocal, localDateKey, startOfLocalDay, type CalEvent } from "./timeline";
export type Period = "7" | "30" | "all";
export type BestHour = {
  hour: number;
  minutes: number;
  count: number;
  energy_n: number;
  avg_energy: number | null;
};
export type Primed = {
  primed_n: number;
  unprimed_n: number;
  primed_avg: number | null;
  unprimed_avg: number | null;
};
export type Summary = {
  start: string;
  end: string;
  session_count: number;
  rating_count: number;
  by_hour: BestHour[];
  by_day: { day: string; minutes: number }[];
  by_week: { week: string; minutes: number }[];
  energy_by_hour: { hour: number; avg: number }[];
  primed: Primed;
  intent_outcomes: { yes: number; partly: number; no: number };
  interruptions: { source: string; reason: string; label: string | null; count: number }[];
  interruptions_by_hour: { hour: number; self: number; external: number; unknown: number }[];
  completion: { planned: number; actual: number; rate: number | null };
  completion_buckets: { bucket: string; count: number; rate: number }[];
  focus_energy: {
    count: number;
    before: number | null;
    after: number | null;
    change: number | null;
  };
  energy_change_by_hour: { hour: number; count: number; change: number }[];
  findings: {
    best: BestHour | null;
    primed: { difference: number } | null;
    interruption: { reason: string; label: string | null; count: number; self: number } | null;
  };
};
export type InsightData = Summary & {
  period: Period;
  last_week: Summary;
  previous_week: Summary;
  trend_start: string;
};
export const periodLabel = (p: Period) =>
  p === "7" ? "in the last 7 days" : p === "30" ? "in the last 30 days" : "overall";
export const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;
export const signed = (n: number, digits = 1) =>
  `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}`;
export const REASON: Record<string, string> = {
  meeting: "Meetings",
  message: "Messages",
  distracted: "Distractions",
  other: "Other interruptions",
};
export function bestHour(rows: BestHour[]) {
  return (
    [...rows]
      .filter((x) => x.count >= 3 && x.energy_n >= 3 && x.avg_energy !== null)
      .sort(
        (a, b) =>
          (b.avg_energy ?? 0) - (a.avg_energy ?? 0) || b.minutes - a.minutes || a.hour - b.hour,
      )[0] ?? null
  );
}
export function primedDifference(p: Primed) {
  return p.primed_n >= 3 && p.unprimed_n >= 3 && p.primed_avg !== null && p.unprimed_avg !== null
    ? p.primed_avg - p.unprimed_avg
    : null;
}
export function weeklySuggestion(
  best: BestHour | null,
  load: number | null,
  top: Summary["findings"]["interruption"],
) {
  if (load !== null && load > 60) return "Leave a little space between meetings next week.";
  if (best)
    return `Your ${hourLabel(best.hour)}–${hourLabel(best.hour + 1)} block was your best — protect it on Tuesday and Thursday.`;
  if (top && top.count >= 3 && top.reason === "message")
    return "Try silencing messages during your next focus block.";
  return "Keep logging focus and energy to find a window worth protecting.";
}
export function highMeetingLoad(weeks: { load: number | null }[]) {
  return weeks.length >= 3 && weeks.slice(-3).every((w) => w.load !== null && w.load > 60);
}
export function mondayKey(now = new Date()) {
  const d = startOfLocalDay(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDateKey(d);
}
export function meetingDays(
  events: CalEvent[],
  start: string,
  end: string,
  hoursFor: (day: Date) => { on: boolean; start: string; end: string },
) {
  const result: { day: string; minutes: number; work: number }[] = [];
  for (
    let day = new Date(`${start}T12:00:00`);
    localDateKey(day) <= end;
    day.setDate(day.getDate() + 1)
  ) {
    const h = hoursFor(day);
    const a = atLocal(day, h.start).getTime(),
      b = h.on ? atLocal(day, h.end).getTime() : a;
    const ranges = events
      .filter((e) => !e.allDay && e.kind !== "focus")
      .map((e): [number, number] => [
        Math.max(a, new Date(e.start).getTime()),
        Math.min(b, new Date(e.end).getTime()),
      ])
      .filter(([s, e]) => e > s)
      .sort((x, y) => x[0] - y[0]);
    let minutes = 0,
      cursor = a;
    for (const [s, e] of ranges) {
      minutes += Math.max(0, e - Math.max(cursor, s)) / 60000;
      cursor = Math.max(cursor, e);
    }
    result.push({
      day: localDateKey(day),
      minutes,
      work: Math.max(0, b - a) / 60000,
    });
  }
  return result;
}
export function meetingWeeks(days: ReturnType<typeof meetingDays>) {
  const map = new Map<
    string,
    { week: string; minutes: number; work: number; load: number | null }
  >();
  for (const d of days) {
    const week = mondayKey(new Date(`${d.day}T12:00:00`));
    const w = map.get(week) ?? { week, minutes: 0, work: 0, load: null };
    w.minutes += d.minutes;
    w.work += d.work;
    w.load = w.work ? (100 * w.minutes) / w.work : null;
    map.set(week, w);
  }
  return [...map.values()];
}
