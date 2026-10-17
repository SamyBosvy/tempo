import { describe, expect, it, vi, beforeEach } from "vitest";
import { effectiveFocusMinutes, focusClock, localDateFromKey, morningEnergyTitle, validWorkHours } from "./fix-rules";
import { deleteWithUndo, restoreDeleted } from "./history-delete";
import { focusTimer, elapsedMs } from "./focus-timer";
import { primeUrl } from "./notify";

describe("B7 custom focus minutes", () => {
  it("snaps values under 5 up to 5", () => expect(effectiveFocusMinutes("3", 50)).toBe(5));
  it("uses the custom value when valid", () => expect(effectiveFocusMinutes("40", 50)).toBe(40));
  it("uses the preset when custom is empty", () => expect(effectiveFocusMinutes("", 25)).toBe(25));
});

describe("B8 morning energy title", () => {
  it("asks about the morning before noon", () => expect(morningEnergyTitle(new Date(2026, 9, 15, 11, 59))).toBe("Energy this morning?"));
  it("asks about right now from 12:00", () => expect(morningEnergyTitle(new Date(2026, 9, 15, 12, 0))).toBe("Energy right now?"));
});

describe("B9 insights dates", () => {
  it("parses YYYY-MM-DD as the local calendar day", () => {
    const d = localDateFromKey("2026-10-14");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 14]);
  });
});

describe("B12 work hours", () => {
  it("rejects end before start", () => expect(validWorkHours("18:00", "08:00")).toBe(false));
  it("rejects equal times", () => expect(validWorkHours("09:00", "09:00")).toBe(false));
  it("accepts end after start", () => expect(validWorkHours("08:00", "18:00")).toBe(true));
});

describe("B1 prime notification link", () => {
  it("opens /prime for that meeting", () => expect(primeUrl("ev1", "2026-10-15T09:00:00Z")).toBe("/prime?event=ev1&at=2026-10-15T09%3A00%3A00Z&auto=1"));
});

describe("B5 focus overtime", () => {
  beforeEach(() => { focusTimer.clear(); vi.useRealTimers(); });
  it("shows overtime as +mm:ss", () => expect(focusClock(26 * 60_000 + 5_000, 25)).toBe("+1:05"));
  it("+5 min adds to the target and leaves overtime", () => {
    focusTimer.start({ targetMin: 25, intention: "", energyBefore: null, nextEventAt: null });
    focusTimer.markOvertime();
    focusTimer.extend(5);
    expect(focusTimer.get()!.targetMin).toBe(30);
    expect(focusTimer.get()!.overtime).toBe(false);
  });
  it("Keep going keeps the session running in overtime", () => {
    focusTimer.start({ targetMin: 25, intention: "", energyBefore: null, nextEventAt: null });
    focusTimer.pause();
    focusTimer.keepGoing();
    const s = focusTimer.get()!;
    expect(s.overtime).toBe(true);
    expect(s.paused).toBe(false);
    expect(elapsedMs(s)).toBeGreaterThanOrEqual(0);
  });
});

function fakeDb(row: Record<string, unknown>) {
  const calls: { op: string; table: string; payload?: unknown }[] = [];
  const from = (table: string) => ({
    select: () => ({
      eq: () => {
        const r = { data: table === "interruptions" ? [{ id: "i1", session_id: row["id"] }] : row, error: null };
        return Object.assign(Promise.resolve(r), { maybeSingle: async () => r });
      },
    }),
    delete: () => ({ eq: async () => { calls.push({ op: "delete", table }); return { error: null }; } }),
    insert: async (payload: unknown) => { calls.push({ op: "insert", table, payload }); return { error: null }; },
  });
  const rpc = async (_name: string, args: { _row: unknown; _interruptions: unknown }) => {
    calls.push({ op: 'restore-atomic', table: 'focus_sessions', payload: args });
    return { error: null };
  };
  return { db: { from, rpc }, calls };
}

describe("B11 history delete", () => {
  it("deletes immediately and Undo re-inserts the same row", async () => {
    const row = { id: "s1", actual_min: 25 };
    const { db, calls } = fakeDb(row);
    const res = await deleteWithUndo(db, "focus_sessions", "s1");
    expect(calls).toEqual([{ op: "delete", table: "focus_sessions" }]);
    if (!res.ok) throw new Error("expected ok");
    await restoreDeleted(db, res.saved);
    expect(calls[1]).toEqual({ op: 'restore-atomic', table: 'focus_sessions', payload: { _row: row, _interruptions: [{id:'i1',session_id:'s1'}] } });
  });
});
