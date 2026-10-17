import { supabase } from "@/integrations/supabase/client";
import { csvCell, downloadCsv, toCsv } from "./csv";

const TABLES = ["user_settings", "focus_sessions", "interruptions", "energy_ratings", "prime_sessions", "event_flags", "manual_blocks", "recurring_blocks", "recurring_skips", "checkin_dismissals"] as const;

/** Page a whole table in 1,000-row chunks. */
async function fetchAll<T>(table: (typeof TABLES)[number]): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return rows;
}

/** Download every row the user owns as JSON. */
export async function exportMyData() {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) out[t] = await fetchAll(t);
  const { data: u } = await supabase.auth.getUser();
  const blob = new Blob(
    [JSON.stringify({ exported_at: new Date().toISOString(), email: u.user?.email, note: "Event titles are never stored by Tempo.", ...out }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tempo-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function localParts(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function todayKey() {
  return localParts(new Date().toISOString()).date;
}

type SessionRow = {
  started_at: string; ended_at: string; planned_min: number; actual_min: number;
  intention: string | null; done_note: string | null; energy_before: number | null;
  energy_after: number | null; parked_thoughts: string[] | null; id: string;
};
type InterruptionRow = { session_id: string; source: string | null };

export async function exportFocusSessionsCsv() {
  const sessions = await fetchAll<SessionRow>("focus_sessions");
  const interruptions = await fetchAll<InterruptionRow>("interruptions");
  const bySession = new Map<string, { total: number; self: number; external: number }>();
  for (const i of interruptions) {
    const c = bySession.get(i.session_id) ?? { total: 0, self: 0, external: 0 };
    c.total += 1;
    if (i.source === "self") c.self += 1;
    if (i.source === "external") c.external += 1;
    bySession.set(i.session_id, c);
  }
  sessions.sort((a, b) => a.started_at.localeCompare(b.started_at));
  const rows = sessions.map((s) => {
    const start = localParts(s.started_at);
    const end = localParts(s.ended_at);
    const c = bySession.get(s.id) ?? { total: 0, self: 0, external: 0 };
    return [
      start.date, start.time, end.time, s.planned_min, s.actual_min,
      s.intention, s.done_note, s.energy_before, s.energy_after,
      c.total, c.self, c.external, (s.parked_thoughts ?? []).join(" | "),
    ];
  });
  downloadCsv(
    `tempo-focus-sessions-${todayKey()}.csv`,
    toCsv(["date", "start", "end", "planned_min", "actual_min", "intention", "done_note", "energy_before", "energy_after", "interruptions_count", "self_interruptions", "external_interruptions", "parked_thoughts"], rows),
  );
}

type RatingRow = { at: string; kind: string; rating: number; note: string | null; primed: boolean | null; intent_outcome: string | null };

export async function exportEnergyRatingsCsv() {
  const ratings = await fetchAll<RatingRow>("energy_ratings");
  ratings.sort((a, b) => a.at.localeCompare(b.at));
  const rows = ratings.map((r) => {
    const p = localParts(r.at);
    return [p.date, p.time, r.kind, r.rating, r.note, r.primed === null ? "" : r.primed ? "yes" : "no", r.intent_outcome];
  });
  downloadCsv(
    `tempo-energy-ratings-${todayKey()}.csv`,
    toCsv(["date", "time", "kind", "rating", "note", "primed", "intent_outcome"], rows),
  );
}

// Re-export so tests can assert cell escaping through the public module.
export { csvCell };
