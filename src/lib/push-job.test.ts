import { expect, it, vi } from 'vitest';
const deliver = vi.hoisted(() => vi.fn());
vi.mock('./google.server', () => ({ getAccessToken: vi.fn() }));
vi.mock('./push.server', () => ({ deliverPush: deliver, vapidKeys: () => ({}) }));
import { runPushJob } from './push-job.server';
it('never processes notifications for a revoked roleless account', async () => {
  vi.stubEnv('VAPID_KEY_SEED','test-seed'); vi.stubEnv('OWNER_EMAIL','owner@example.invalid');
  const visited: string[] = [];
  const db = {from: (table: string) => {
    visited.push(table);
    const query = {select: () => query,eq: () => query,order: () => query,
      range: async () => ({data:[{user_id:'revoked'}],error:null}),
      maybeSingle: async () => ({data:null,error:null})}; return query;
  }};
  expect(await runPushJob(db as unknown as Parameters<typeof runPushJob>[0])).toEqual({sent:0});
  expect(visited).toEqual(['user_settings','user_roles']);
  expect(deliver).not.toHaveBeenCalled(); vi.unstubAllEnvs();
});