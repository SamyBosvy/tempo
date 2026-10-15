import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteWithUndo, restoreDeleted } from "@/lib/history-delete";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fmtTime, localDateKey, startOfLocalDay } from "@/lib/timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, EnergyPicker, PageTitle, ScreenSkeleton } from "@/components/tempo/bits";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "History · Tempo" },
      { name: "description", content: "Past sessions, primes and energy." },
      { property: "og:title", content: "History · Tempo" },
      { property: "og:description", content: "Past sessions, primes and energy." },
    ],
  }),
  component: History,
});

type Entry =
  | { type: "session"; id: string; at: string; actual_min: number; intention: string | null; done_note: string | null; energy_before: number | null; energy_after: number | null; interruptions: number }
  | { type: "prime"; id: string; at: string; pattern: string; duration_s: number; intention: string | null }
  | { type: "rating"; id: string; at: string; kind: string; rating: number; note: string | null };

const WEEK = 7;
const REASONS: Record<string, string> = { sigh: "Physiological sigh", box: "Box breathing", "478": "4-7-8" };

function History() {
  const qc = useQueryClient();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<Entry | null>(null);

  // Today and past dates, one week per page (page 0 ends at tomorrow 00:00).
  const q = useInfiniteQuery({
    queryKey: ["history"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const to = startOfLocalDay(new Date());
      to.setDate(to.getDate() + 1 - pageParam * WEEK);
      const from = new Date(to);
      from.setDate(from.getDate() - WEEK);
      const [s, p, r] = await Promise.all([
        supabase.from("focus_sessions").select("id, started_at, actual_min, intention, done_note, energy_before, energy_after, interruptions(count)").gte("started_at", from.toISOString()).lt("started_at", to.toISOString()).order("started_at", { ascending: false }),
        supabase.from("prime_sessions").select("id, at, pattern, duration_s, intention").gte("at", from.toISOString()).lt("at", to.toISOString()),
        supabase.from("energy_ratings").select("id, at, kind, rating, note").gte("at", from.toISOString()).lt("at", to.toISOString()),
      ]);
      if (s.error) throw s.error;
      if (p.error) throw p.error;
      if (r.error) throw r.error;
      const entries: Entry[] = [
        ...s.data.map((x) => ({ type: "session" as const, id: x.id, at: x.started_at, actual_min: x.actual_min, intention: x.intention, done_note: x.done_note, energy_before: x.energy_before, energy_after: x.energy_after, interruptions: (x.interruptions as unknown as { count: number }[])?.[0]?.count ?? 0 })),
        ...p.data.map((x) => ({ type: "prime" as const, ...x })),
        ...r.data.map((x) => ({ type: "rating" as const, ...x })),
      ].sort((a, b) => b.at.localeCompare(a.at));
      return { entries, page: pageParam };
    },
    getNextPageParam: (last) => (last.page < 52 ? last.page + 1 : undefined),
  });

  const table = (e: Entry) => (e.type === "session" ? "focus_sessions" : e.type === "prime" ? "prime_sessions" : "energy_ratings");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["history"] });
    qc.invalidateQueries({ queryKey: ["insights"] });
    qc.invalidateQueries({ queryKey: ["daylogs"] });
  };
  const unhide = (id: string) => setHidden((h) => { const n = new Set(h); n.delete(id); return n; });

  // Deletes in the database straight away; Undo re-inserts the saved row.
  async function remove(e: Entry) {
    setHidden((h) => new Set(h).add(e.id));
    const res = await deleteWithUndo(supabase, table(e), e.id);
    if (!res.ok) {
      toast.error("Couldn't delete that. Try again.");
      unhide(e.id);
      return;
    }
    refresh();
    toast("Deleted.", {
      duration: 8000,
      action: {
        label: "Undo",
        onClick: async () => {
          const ok = await restoreDeleted(supabase, res.saved);
          if (!ok) { toast.error("Couldn't restore that entry."); return; }
          unhide(e.id);
          refresh();
        },
      },
    });
  }

  if (q.isLoading) return <ScreenSkeleton rows={6} />;
  if (q.isError) return <p role="alert">Couldn't load history. Try again.</p>;

  const all = (q.data?.pages ?? []).flatMap((p) => p.entries).filter((e) => !hidden.has(e.id));
  const byDay = new Map<string, Entry[]>();
  for (const e of all) {
    const k = localDateKey(new Date(e.at));
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }

  return (
    <div className="space-y-4">
      <PageTitle>History</PageTitle>
      {byDay.size === 0 && <Card><p className="text-muted-foreground">Nothing logged yet.</p></Card>}
      {[...byDay.entries()].map(([k, list]) => (
        <section key={k} aria-labelledby={`d-${k}`}>
          <h2 id={`d-${k}`} className="mb-2 text-sm font-semibold text-muted-foreground">
            {new Date(k + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          <ul className="space-y-2">
            {list.map((e) => (
              <li key={e.id}>
                <button className="w-full rounded-2xl border border-subtle bg-card p-3 text-left" onClick={() => setEdit(e)}>
                  <Line e={e} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {q.hasNextPage && (
        <Button variant="outline" className="w-full" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
          {q.isFetchingNextPage ? "Loading…" : "Earlier"}
        </Button>
      )}
      {edit && <EditDialog entry={edit} onClose={() => setEdit(null)} onDelete={() => { remove(edit); setEdit(null); }} table={table(edit)} />}
    </div>
  );
}

function Line({ e }: { e: Entry }) {
  if (e.type === "session")
    return (
      <>
        <div className="font-semibold tabular">
          Focus · {e.actual_min} min{e.energy_before || e.energy_after ? ` · energy ${e.energy_before ?? "–"} → ${e.energy_after ?? "–"}` : ""}
        </div>
        <div className="text-sm text-muted-foreground">
          {fmtTime(e.at)}{e.intention ? ` · ${e.intention}` : ""}{e.interruptions ? ` · ${e.interruptions} interruption${e.interruptions > 1 ? "s" : ""}` : ""}
        </div>
      </>
    );
  if (e.type === "prime")
    return (
      <>
        <div className="font-semibold">Prime · {REASONS[e.pattern] ?? e.pattern}</div>
        <div className="text-sm text-muted-foreground">{fmtTime(e.at)} · {Math.round(e.duration_s / 60)} min{e.intention ? ` · ${e.intention}` : ""}</div>
      </>
    );
  return (
    <>
      <div className="font-semibold">{e.kind === "morning" ? "Morning energy" : "After meeting"} · {e.rating}</div>
      <div className="text-sm text-muted-foreground">{fmtTime(e.at)}{e.note ? ` · ${e.note}` : ""}</div>
    </>
  );
}

function EditDialog({ entry, onClose, onDelete, table }: { entry: Entry; onClose: () => void; onDelete: () => void; table: "focus_sessions" | "prime_sessions" | "energy_ratings" }) {
  const qc = useQueryClient();
  const [text, setText] = useState(entry.type === "rating" ? entry.note ?? "" : entry.intention ?? "");
  const [note, setNote] = useState(entry.type === "session" ? entry.done_note ?? "" : "");
  const [eb, setEb] = useState(entry.type === "session" ? entry.energy_before : null);
  const [ea, setEa] = useState(entry.type === "session" ? entry.energy_after : entry.type === "rating" ? entry.rating : null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const patch =
      entry.type === "session"
        ? { intention: text.trim() || null, done_note: note.trim() || null, energy_before: eb, energy_after: ea }
        : entry.type === "prime"
          ? { intention: text.trim() || null }
          : { note: text.trim() || null, rating: ea ?? 3 };
    const { error } = await supabase.from(table).update(patch as never).eq("id", entry.id);
    setBusy(false);
    if (error) { toast.error("Couldn't save. Try again."); return; }
    qc.invalidateQueries({ queryKey: ["history"] });
    qc.invalidateQueries({ queryKey: ["insights"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Edit entry</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="et">{entry.type === "rating" ? "Note" : "Intention"}</Label>
          <Input id="et" maxLength={200} className="h-12" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        {entry.type === "session" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="en">What got done</Label>
              <Input id="en" maxLength={200} className="h-12" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <p className="text-sm font-semibold">Energy before</p>
            <EnergyPicker label="Energy before" value={eb} onChange={setEb} />
          </>
        )}
        {entry.type !== "prime" && (
          <>
            <p className="text-sm font-semibold">{entry.type === "session" ? "Energy after" : "Energy"}</p>
            <EnergyPicker label="Energy" value={ea} onChange={setEa} />
          </>
        )}
        <DialogFooter>
          <Button variant="ghost" className="h-12 text-destructive" onClick={onDelete}>Delete</Button>
          <Button size="lg" disabled={busy} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
