export type ReminderKind = 'prime' | 'focus' | 'checkin' | 'weekly';
export function reminderKey(kind: ReminderKind, id: string, at: string) { return `${kind}:${id}:${at}`; }
export function primeDue(now: number, start: number, lead: number) { return now >= start - lead * 60_000 && now < start; }
export function focusDue(now: number, end: number) { return now >= end && now < end + 10 * 60_000; }
export function checkinDue(now: number, end: number, rated: boolean, dismissed: boolean) { return !rated && !dismissed && now >= end + 2 * 60_000 && now < end + 24 * 3600_000; }
export function weeklyDue(weekday: number, hour: number) { return weekday === 1 && hour >= 8 && hour < 12; }
export function presenceAlive(now: number, until: string | null) { return Boolean(until && Date.parse(until) > now); }
export function validPushEndpoint(raw: string) { try { const u = new URL(raw); return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && (u.hostname === 'fcm.googleapis.com' || u.hostname === 'updates.push.services.mozilla.com' || u.hostname.endsWith('.push.services.mozilla.com') || u.hostname === 'web.push.apple.com' || u.hostname.endsWith('.notify.windows.com')); } catch { return false; } }
export function zonedParts(now: number, timezone: string) {
 const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',weekday:'short' }).formatToParts(now);
 const get=(t:string)=>parts.find(p=>p.type===t)?.value??'';
 return { day:`${get('year')}-${get('month')}-${get('day')}`, hour:Number(get('hour')), weekday:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday')) };
}
