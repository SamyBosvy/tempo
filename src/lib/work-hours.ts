// Per-weekday working hours (0 = Sunday). Falls back to the legacy work_start/work_end
// columns (Mon–Fri on, Sat–Sun off) when a day is missing or malformed.
import { atLocal, startOfLocalDay } from "./timeline";

export type DayHours = { on: boolean; start: string; end: string };
export type WorkHours = Record<string, DayHours>;
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type HoursSource = { work_hours?: unknown; work_start: string; work_end: string };
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function defaultWorkHours(start = "08:00", end = "18:00"): WorkHours {
  const out: WorkHours = {};
  for (let d = 0; d < 7; d++) out[d] = { on: d >= 1 && d <= 5, start, end };
  return out;
}

function isDay(v: unknown): v is DayHours {
  const x = v as DayHours;
  return !!x && typeof x.on === "boolean" && HHMM.test(x.start ?? "") && HHMM.test(x.end ?? "");
}

export function resolveWorkHours(s: HoursSource): WorkHours {
  const fb = defaultWorkHours(s.work_start.slice(0, 5), s.work_end.slice(0, 5));
  const raw = (s.work_hours && typeof s.work_hours === "object" ? s.work_hours : {}) as Record<string, unknown>;
  const out: WorkHours = {};
  for (let d = 0; d < 7; d++) out[d] = isDay(raw[d]) ? (raw[d] as DayHours) : fb[d]!;
  return out;
}

export function dayHours(s: HoursSource, dow: number): DayHours {
  return resolveWorkHours(s)[dow]!;
}

export function dayError(d: DayHours): string | null {
  if (!d.on) return null;
  if (!HHMM.test(d.start) || !HHMM.test(d.end)) return "Enter both times.";
  return d.end > d.start ? null : "End must be after start. Not saved.";
}

export function copyMondayToWeekdays(h: WorkHours): WorkHours {
  const out = { ...h };
  for (const d of [2, 3, 4, 5]) out[d] = { ...h[1]! };
  return out;
}

/** The day's working window. On a day off `on` is false and start === end (no slots). */
export function workWindow(s: HoursSource, day: Date) {
  const h = dayHours(s, day.getDay());
  if (!h.on) {
    const z = startOfLocalDay(day);
    return { on: false, start: z, end: z, hours: h };
  }
  return { on: true, start: atLocal(day, h.start), end: atLocal(day, h.end), hours: h };
}
