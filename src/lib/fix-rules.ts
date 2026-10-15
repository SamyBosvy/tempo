// Small pure rules shared by screens, kept here so they can be unit-tested.

export const MIN_FOCUS_MIN = 5;
export const MAX_FOCUS_MIN = 600;

/** Length the focus timer will actually use, given the custom box and the chosen preset. */
export function effectiveFocusMinutes(custom: string, preset: number) {
  if (!custom) return preset;
  const n = Number(custom);
  if (!Number.isFinite(n)) return preset;
  return Math.min(MAX_FOCUS_MIN, Math.max(MIN_FOCUS_MIN, Math.round(n)));
}

/** Title for the morning energy card; after midday it asks about right now. */
export function morningEnergyTitle(now: Date) {
  return now.getHours() >= 12 ? "Energy right now?" : "Energy this morning?";
}

/** Parse a YYYY-MM-DD (or ISO-prefixed) value as a local calendar date at noon. */
export function localDateFromKey(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

/** Work end must be strictly after work start (HH:MM). */
export function validWorkHours(start: string, end: string) {
  return /^\d{2}:\d{2}/.test(start) && /^\d{2}:\d{2}/.test(end) && end.slice(0, 5) > start.slice(0, 5);
}

/** Display a focus clock: countdown while time remains, +mm:ss in overtime. */
export function focusClock(elapsedMs: number, targetMin: number) {
  const target = targetMin * 60_000;
  const over = elapsedMs > target;
  const ms = over ? elapsedMs - target : Math.max(0, target - elapsedMs);
  const mm = Math.floor(ms / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  return `${over ? "+" : ""}${mm}:${String(ss).padStart(2, "0")}`;
}
