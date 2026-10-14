import { supabase } from "@/integrations/supabase/client";

const TABLES = ["user_settings", "focus_sessions", "interruptions", "energy_ratings", "prime_sessions", "event_flags", "manual_blocks"] as const;

/** Download every row the user owns as JSON. Pages in 1,000-row chunks. */
export async function exportMyData() {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(t).select("*").range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    out[t] = rows;
  }
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
