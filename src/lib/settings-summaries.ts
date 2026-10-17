import type { Settings } from './settings';
import { isBreathPattern, PATTERNS } from './breath';
import { DAY_NAMES, resolveWorkHours, WEEK_ORDER } from './work-hours';

export function daySummary(s: Settings) {
  const hours = resolveWorkHours(s);
  const days = WEEK_ORDER.filter(day => hours[day]?.on);
  const first = hours[days[0] ?? -1];
  let schedule = 'No work hours set';
  if (first) {
    const uniform = days.every(day => hours[day]?.start === first.start && hours[day]?.end === first.end);
    if (!uniform) schedule = 'Custom hours';
    else {
      const names = days.map(day => DAY_NAMES[day]?.slice(0, 3) ?? '');
      const consecutive = days.every((day, index) => index === 0 || day === ((days[index - 1] ?? 0) + 1) % 7);
      const label = days.length === 7 ? 'Every day' : days.length > 1 && consecutive ? `${names[0]}–${names.at(-1)}` : names.join(', ');
      schedule = `${label} · ${first.start}–${first.end}`;
    }
  }
  return `${schedule} · ${s.meeting_buffer_min} min buffer`;
}

export function durationSummary(minutes: number) {
  return minutes % 60 === 0 ? `${minutes / 60} h` : minutes > 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

export function focusSummary(s: Settings) {
  return `${durationSummary(s.daily_focus_target_min)} daily target · ${s.min_focus_min} min minimum`;
}

export function breathingSummary(s: Settings) {
  const pattern = isBreathPattern(s.breath_pattern) ? PATTERNS[s.breath_pattern].name : s.breath_pattern;
  return `${pattern} · ${s.breath_minutes} min · ${s.prime_lead_min} min before`;
}

export function calendarSummary(s: Settings, status?: string, failed = false) {
  if (status === 'reconnect') return 'Reconnect needed';
  if (status === 'connected') return s.google_email ? `Connected as ${s.google_email}` : 'Connected';
  if (failed) return 'Status unavailable';
  if (!status) return 'Checking connection…';
  return 'Not connected';
}

export function reminderCount(s: Settings) {
  return [s.notifications, s.end_notify, s.checkin_notify, s.weekly_review_notify].filter(Boolean).length;
}

export function notificationSummary(s: Settings, permission: string) {
  if (permission === 'denied') return 'Blocked in browser';
  return `${reminderCount(s)} reminders on`;
}

export function dataSummary(queued: number) {
  return `Export or delete${queued > 0 ? ` · ${queued} waiting to sync` : ''}`;
}