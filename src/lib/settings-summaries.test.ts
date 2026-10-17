import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { defaultWorkHours } from './work-hours';
import { breathingSummary, calendarSummary, dataSummary, daySummary, focusSummary, notificationSummary } from './settings-summaries';

const settings: Settings = { ...DEFAULT_SETTINGS, user_id: 'test', updated_at: '', work_hours: defaultWorkHours('09:00', '17:30'), daily_focus_target_min: 180 };

describe('Settings summaries', () => {
  it('summarises uniform weekdays and the saved buffer', () => {
    expect(daySummary(settings)).toBe('Mon–Fri · 09:00–17:30 · 5 min buffer');
  });
  it('uses custom hours when enabled days differ', () => {
    const hours = defaultWorkHours('09:00', '17:30');
    hours['2'] = { on: true, start: '10:00', end: '17:30' };
    expect(daySummary({ ...settings, work_hours: hours })).toBe('Custom hours · 5 min buffer');
  });
  it('does not invent hours on days off', () => {
    const hours = defaultWorkHours();
    Object.values(hours).forEach(day => day.on = false);
    expect(daySummary({ ...settings, work_hours: hours })).toBe('No work hours set · 5 min buffer');
  });
  it('summarises the saved focus duration without rounding', () => {
    expect(focusSummary(settings)).toBe('3 h daily target · 25 min minimum');
    expect(focusSummary({ ...settings, daily_focus_target_min: 150 })).toBe('2 h 30 min daily target · 25 min minimum');
  });
  it('shows the saved breathing pattern, duration and lead', () => {
    expect(breathingSummary(settings)).toBe('Physiological sigh · 2 min · 10 min before');
  });
  it('uses actual calendar status rather than a stale saved email', () => {
    const s = { ...settings, google_email: 'member@example.test' };
    expect(calendarSummary(s, 'connected')).toBe('Connected as member@example.test');
    expect(calendarSummary(s, 'reconnect')).toBe('Reconnect needed');
    expect(calendarSummary(s, 'disconnected')).toBe('Not connected');
    expect(calendarSummary(s)).toBe('Checking connection…');
  });
  it('counts reminder types, not sound, vibration or delivery switches', () => {
    expect(notificationSummary({ ...settings, notifications: true, push_enabled: true, end_sound: true, vibration: true }, 'granted')).toBe('4 reminders on');
    expect(notificationSummary(settings, 'denied')).toBe('Blocked in browser');
  });
  it('includes pending entries only when there are entries waiting', () => {
    expect(dataSummary(0)).toBe('Export or delete');
    expect(dataSummary(2)).toBe('Export or delete · 2 waiting to sync');
  });
});