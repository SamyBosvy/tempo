// History delete: remove from the database immediately, keep the saved row
// (and a session's interruptions, which cascade) so Undo can re-insert them
// with the same ids and values. Closing the app simply leaves it deleted.
type Table = "focus_sessions" | "prime_sessions" | "energy_ratings";
type Row = Record<string, unknown>;
export type Saved = { table: Table; row: Row; interruptions: Row[] };

// Minimal client surface so tests can pass a fake.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = { from: (t: string) => any };

export async function deleteWithUndo(db: Client, table: Table, id: string): Promise<{ ok: true; saved: Saved } | { ok: false }> {
  const got = await db.from(table).select("*").eq("id", id).maybeSingle();
  if (got.error || !got.data) return { ok: false };
  let interruptions: Row[] = [];
  if (table === "focus_sessions") {
    const ir = await db.from("interruptions").select("*").eq("session_id", id);
    if (ir.error) return { ok: false };
    interruptions = ir.data ?? [];
  }
  const del = await db.from(table).delete().eq("id", id);
  if (del.error) return { ok: false };
  return { ok: true, saved: { table, row: got.data, interruptions } };
}

export async function restoreDeleted(db: Client, saved: Saved): Promise<boolean> {
  const a = await db.from(saved.table).insert(saved.row);
  if (a.error && a.error.code !== "23505") return false;
  if (saved.interruptions.length) {
    const b = await db.from("interruptions").insert(saved.interruptions);
    if (b.error && b.error.code !== "23505") return false;
  }
  return true;
}
