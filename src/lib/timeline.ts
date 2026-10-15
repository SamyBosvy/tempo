// Pure scheduling logic for Today. No I/O.

export type CalEvent = {
  id: string;
  title: string;
  start: string; // ISO UTC
  end: string;
  allDay: boolean;
  source: "google" | "manual";
  kind?: "meeting" | "focus";
};

export type Slot = {
  start: Date;
  end: Date;
  minutes: number;
  isWindow: boolean;
  best: boolean;
};

/** Build a Date for a local day + "HH:MM" (or "HH:MM:SS"). */
export function atLocal(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h ?? 0, m || 0, 0, 0);
  return d;
}

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

export function fmtTime(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Timed (non all-day) events, excluding manual focus blocks, clipped to [from, to]. */
export function busyBlocks(events: CalEvent[], from: Date, to: Date) {
  return events
    .filter((e) => !e.allDay && e.kind !== "focus")
    .map((e) => ({ start: new Date(e.start), end: new Date(e.end) }))
    .filter((b) => b.end > from && b.start < to)
    .map((b) => ({
      start: b.start < from ? from : b.start,
      end: b.end > to ? to : b.end,
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Open slots between events within working hours.
 * `now` clips the start so past time is never offered as a focus window.
 */
export function computeSlots(
  events: CalEvent[],
  workStart: Date,
  workEnd: Date,
  minFocusMin: number,
  now?: Date,
  bufferMin = 0,
): Slot[] {
  const from = now && now > workStart ? now : workStart;
  if (from >= workEnd) return [];
  // Include meetings that ended within the buffer before `from`, so their buffer still applies.
  const blocks = busyBlocks(events, new Date(from.getTime() - bufferMin * 60_000), workEnd);
  const slots: Slot[] = [];
  let cursor = from;
  for (const b of blocks) {
    if (b.start > cursor) push(cursor, b.start);
    const after = new Date(Math.min(b.end.getTime() + bufferMin * 60_000, workEnd.getTime()));
    if (after > cursor) cursor = after;
  }
  if (cursor < workEnd) push(cursor, workEnd);

  function push(s: Date, e: Date) {
    const minutes = Math.floor((e.getTime() - s.getTime()) / 60000);
    if (minutes <= 0) return;
    slots.push({ start: s, end: e, minutes, isWindow: minutes >= minFocusMin, best: false });
  }
  let best: Slot | null = null;
  for (const s of slots) if (s.isWindow && (!best || s.minutes > best.minutes)) best = s;
  if (best) best.best = true;
  return slots;
}

/** Session length that fits a window, ending `bufferMin` before the next event. */
export function sessionLengthForWindow(slot: Slot, now: Date, bufferMin = 5): number {
  const start = now > slot.start ? now : slot.start;
  return Math.max(5, Math.floor((slot.end.getTime() - start.getTime()) / 60000) - bufferMin);
}

export function matchesKeywords(title: string, keywords: string[]): boolean {
  const t = title.toLowerCase();
  return keywords.some((k) => k.trim() && t.includes(k.trim().toLowerCase()));
}

export function meetingMinutes(events: CalEvent[], from: Date, to: Date): number {
  return busyBlocks(events, from, to).reduce(
    (a, b) => a + (b.end.getTime() - b.start.getTime()) / 60000,
    0,
  );
}

// ---------- Recurring blocks ----------
export type RecurringBlock = {
  id: string;
  kind: string;
  label: string | null;
  start_time: string;
  end_time: string;
  days: number[];
  active: boolean;
};
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** Recurring blocks that occur on `day` (local), minus skipped ones, as calendar events. */
export function expandRecurring(blocks: RecurringBlock[], skips: { block_id: string; local_date: string }[], day: Date): CalEvent[] {
  const key = localDateKey(day);
  const dow = day.getDay();
  const skipped = new Set(skips.filter((s) => s.local_date === key).map((s) => s.block_id));
  return blocks
    .filter((b) => b.active && b.days.includes(dow) && !skipped.has(b.id))
    .map((b) => ({
      id: `recurring:${b.id}:${key}`,
      title: b.label || (b.kind === "meeting" ? "Meeting" : "Focus"),
      start: atLocal(day, b.start_time).toISOString(),
      end: atLocal(day, b.end_time).toISOString(),
      allDay: false,
      source: "manual" as const,
      kind: b.kind === "focus" ? ("focus" as const) : ("meeting" as const),
    }));
}

// ---------- Back-to-back runs ----------
/** First run of 3+ busy blocks with gaps under `maxGapMin`, that hasn't ended yet. */
export function backToBackRun(events: CalEvent[], from: Date, to: Date, now: Date, maxGapMin = 10, minCount = 3) {
  const blocks = busyBlocks(events, from, to);
  const merged: { start: Date; end: Date; count: number }[] = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (last && b.start.getTime() - last.end.getTime() < maxGapMin * 60_000) {
      if (b.end > last.end) last.end = b.end;
      last.count++;
    } else merged.push({ start: b.start, end: b.end, count: 1 });
  }
  return merged.find((r) => r.count >= minCount && r.end > now) ?? null;
}

// ---------- Day ribbon ----------
export type RibbonSegment = { id: string; kind: "meeting" | "stressful" | "focus" | "manual-focus"; x: number; w: number };
/** Segments as fractions (0–1) of the working day. */
export function ribbonSegments(
  events: { id: string; start: string; end: string; allDay: boolean; kind?: string; stressful?: boolean }[],
  slots: Slot[],
  workStart: Date,
  workEnd: Date,
): RibbonSegment[] {
  const span = workEnd.getTime() - workStart.getTime();
  if (span <= 0) return [];
  const frac = (s: Date, e: Date) => {
    const a = Math.max(0, (s.getTime() - workStart.getTime()) / span);
    const b = Math.min(1, (e.getTime() - workStart.getTime()) / span);
    return b > a ? { x: a, w: b - a } : null;
  };
  const out: RibbonSegment[] = [];
  for (const sl of slots) {
    if (!sl.isWindow) continue;
    const f = frac(sl.start, sl.end);
    if (f) out.push({ id: `slot:${sl.start.getTime()}`, kind: "focus", ...f });
  }
  for (const e of events) {
    if (e.allDay) continue;
    const f = frac(new Date(e.start), new Date(e.end));
    if (!f) continue;
    out.push({ id: e.id, kind: e.kind === "focus" ? "manual-focus" : e.stressful ? "stressful" : "meeting", ...f });
  }
  return out.sort((a, b) => a.x - b.x);
}

/** Position (0–1) of `now` across the working day, or null outside it. */
export function nowFraction(now: Date, workStart: Date, workEnd: Date) {
  const span = workEnd.getTime() - workStart.getTime();
  if (span <= 0 || now < workStart || now > workEnd) return null;
  return (now.getTime() - workStart.getTime()) / span;
}

export function fmtMinutesShort(start: string, end: string) {
  return fmtDuration((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}
