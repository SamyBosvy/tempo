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
  d.setHours(h, m || 0, 0, 0);
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
): Slot[] {
  const from = now && now > workStart ? now : workStart;
  if (from >= workEnd) return [];
  const blocks = busyBlocks(events, from, workEnd);
  const slots: Slot[] = [];
  let cursor = from;
  for (const b of blocks) {
    if (b.start > cursor) push(cursor, b.start);
    if (b.end > cursor) cursor = b.end;
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
