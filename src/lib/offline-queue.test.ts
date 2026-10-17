import { describe, expect, it, vi, beforeEach } from "vitest";

const upsert = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ upsert }) } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

import { __resetQueueForTests, attentionRows, enqueue, flush, pendingRows, retryAttention, discardAttention, setQueueUser } from "./offline-queue";

const bad = (row: { id?: unknown }) => (row.id === "bad" ? { error: { code: "22P02", message: "invalid input" } } : { error: null });

describe("B4 offline queue", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetQueueForTests();
    setQueueUser('user-a');
    upsert.mockReset();
  });

  it("a bad row does not block later saves", async () => {
    upsert.mockImplementation(async (row) => bad(row));
    enqueue("energy_ratings", { id: "bad" });
    enqueue("energy_ratings", { id: "good" });
    await new Promise((r) => setTimeout(r, 0));
    await flush();
    const saved = upsert.mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(saved).toContain("good");
    expect(pendingRows("energy_ratings").map((r) => r["id"])).toEqual(["bad"]);
  });
  it('never displays or replays another account’s pending notes', async () => {
    upsert.mockResolvedValue({error:{code:'network',message:'network failed'}});
    enqueue('energy_ratings',{id:'private-a',note:'private note'});
    await flush();
    expect(pendingRows('energy_ratings')[0]?.['user_id']).toBe('user-a');
    setQueueUser('user-b');
    expect(pendingRows('energy_ratings')).toEqual([]);
    upsert.mockClear(); await flush(); expect(upsert).not.toHaveBeenCalled();
    setQueueUser('user-a'); expect(pendingRows('energy_ratings')[0]?.['id']).toBe('private-a');
  });

  it("moves a row to needs attention after 3 failed attempts", async () => {
    upsert.mockImplementation(async (row) => bad(row));
    enqueue("energy_ratings", { id: "bad" });
    await flush();
    await flush();
    expect(attentionRows()).toHaveLength(0);
    await flush();
    expect(attentionRows().map((o) => o.row["id"])).toEqual(["bad"]);
    expect(pendingRows("energy_ratings")).toHaveLength(0);
  });

  it("Retry re-queues and Discard removes", async () => {
    upsert.mockImplementation(async (row) => bad(row));
    enqueue("energy_ratings", { id: "bad" });
    for (let i = 0; i < 3; i++) await flush();
    upsert.mockImplementation(async () => ({ error: null }));
    await retryAttention(attentionRows()[0]!.qid);
    expect(attentionRows()).toHaveLength(0);
    expect(pendingRows("energy_ratings")).toHaveLength(0);

    upsert.mockImplementation(async (row) => bad(row));
    enqueue("energy_ratings", { id: "bad" });
    for (let i = 0; i < 3; i++) await flush();
    discardAttention(attentionRows()[0]!.qid);
    expect(attentionRows()).toHaveLength(0);
  });
});
