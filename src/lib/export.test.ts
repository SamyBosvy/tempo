import { expect, it, vi } from 'vitest';
const orders = vi.hoisted(() => new Map<string, string[]>());
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (table: string) => {
    const query = { select: () => query, order: (column: string) => {
      orders.set(table, [...(orders.get(table) ?? []), column]); return query;
    }, range: async () => ({ data: [], error: null }) };
    return query;
  }, auth: { getUser: async () => ({ data: { user: null } }) },
} }));
vi.mock('./offline-queue', () => ({pendingRows: () => [], attentionRows: () => []}));
import { exportMyData } from './export';
it('exports every private push/recurrence table using its real stable key', async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.stubGlobal('URL', Object.assign(URL, {createObjectURL: () => 'blob:test', revokeObjectURL: () => {}}));
  await exportMyData();
  expect(orders.get('event_flags')).toEqual(['event_id']);
  expect(orders.get('recurring_skips')).toEqual(['block_id','local_date']);
  expect(orders.get('checkin_dismissals')).toEqual(['event_id','local_date']);
  expect(orders.get('push_subscriptions')).toEqual(['id']);
  expect(orders.get('push_focus_deadlines')).toEqual(['session_id']);
  expect(orders.get('push_presence')).toEqual(['user_id']);
  expect(orders.get('reminder_claims')).toEqual(['reminder_key']);
  click.mockRestore(); vi.unstubAllGlobals();
});