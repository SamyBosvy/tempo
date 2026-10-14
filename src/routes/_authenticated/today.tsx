import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Settings as Gear, Plus, Wind, Zap, CalendarOff } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/lib/settings";
import { useDayEvents, useDayLogs, type DayEvent } from "@/lib/day-data";
import { atLocal, computeSlots, fmtDuration, fmtTime, localDateKey, meetingMinutes, sessionLengthForWindow, startOfLocalDay, type Slot } from "@/lib/timeline";
import { enqueue } from "@/lib/offline-queue";
import { useNow } from "@/lib/use-now";
import { Card, EnergyPicker } from "@/components/tempo/bits";
import { ConnectGoogleButton } from "@/components/tempo/ConnectGoogle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today · Tempo" },
      { name: "description", content: "Your day, focus windows and meetings." },
      { property: "og:title", content: "Today · Tempo" },
      { property: "og:description", content: "Your day, focus windows and meetings." },
    ],
  }),
  component: Today,
});

function Today() {
  const { data: settings } = useSettings();
  const [offset, setOffset] = useState(0);
  const now = useNow(30_000);
  const day = useMemo(() => {
    const d = startOfLocalDay(new Date(now));
    d.setDate(d.getDate() + offset);
    return d;
  }, [offset, now]);
  const isToday = offset === 0;
  const keywords = settings?.keywords ?? [];
  const { events, status, isLoading, offline } = useDayEvents(day, keywords);
  const logs = useDayLogs(day);

  if (!settings || isLoading) return <TodaySkeleton />;

  const workStart = atLocal(day, settings.work_start);
  const workEnd = atLocal(day, settings.work_end);
  const timed = events.filter((e) => !e.allDay);
  const allDay = events.filter((e) => e.allDay);
  const slots = computeSlots(timed, workStart, workEnd, settings.min_focus_min, isToday ? new Date(now) : undefined);
  const windows = slots.filter((s) => s.isWindow);
  const meetMin = meetingMinutes(timed, workStart, workEnd);
  const focusMin = (logs.data?.sessions ?? []).reduce((a, s) => a + (s.actual_min ?? 0), 0);
  const morning = logs.data?.ratings.find((r) => r.kind === "morning");
  const nextEvent = timed.find((e) => new Date(e.start).getTime() > now && e.kind === "meeting");

  const headline = (() => {
    if (!isToday) return day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const first = slots.find((s) => s.isWindow && s.start.getTime() <= now + 60_000);
    if (first) return `Clear run until ${fmtTime(first.end)}.`;
    if (nextEvent) return `Next up at ${fmtTime(nextEvent.start)}.`;
    return "Nothing else today.";
  })();

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-accent-text">
            {isToday ? "Today" : offset === 1 ? "Tomorrow" : day.toLocaleDateString("en-GB", { weekday: "long" })}
          </p>
          <h1 className="text-2xl font-semibold leading-tight">{headline}</h1>
        </div>
        <Button asChild variant="ghost" size="icon" aria-label="Settings">
          <Link to="/settings"><Gear /></Link>
        </Button>
      </header>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="Previous day" disabled={offset === 0} onClick={() => setOffset((o) => o - 1)}>
          <ChevronLeft />
        </Button>
        <span className="text-sm text-muted-foreground">
          {day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          {!isToday && " · planning view"}
        </span>
        <Button variant="ghost" size="icon" aria-label="Next day" disabled={offset >= 6} onClick={() => setOffset((o) => o + 1)}>
          <ChevronRight />
        </Button>
      </div>

      {(status === "reconnect" || (status === "disconnected" && settings.google_email)) && (
        <Card className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm">
            <CalendarOff className="h-5 w-5 text-muted-foreground" aria-hidden /> Calendar disconnected
          </span>
          <ConnectGoogleButton label="Reconnect" size="sm" />
        </Card>
      )}
      {status === "disconnected" && !settings.google_email && isToday && (
        <Card className="space-y-3">
          <p className="text-sm text-muted-foreground">Connect your calendar to find focus time, or add blocks by hand.</p>
          <ConnectGoogleButton label="Connect Google Calendar" />
        </Card>
      )}
      {offline && <p className="text-sm text-muted-foreground">Offline · showing the last loaded day.</p>}

      {isToday && !morning && <MorningCheck dayKey={localDateKey(day)} />}

      {isToday && <PrimeCards events={timed} leadMin={settings.prime_lead_min} now={now} primedIds={new Set((logs.data?.primes ?? []).map((p) => p.event_id))} />}
      {isToday && (
        <AfterMeetingCards
          events={timed}
          now={now}
          rated={new Set((logs.data?.ratings ?? []).filter((r) => r.kind === "after_meeting").map((r) => r.event_id))}
          primed={new Set((logs.data?.primes ?? []).map((p) => p.event_id))}
          dayKey={localDateKey(day)}
        />
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <Glance label="Meetings" value={fmtDuration(meetMin)} />
        <Glance label="Focus so far" value={fmtDuration(focusMin)} />
        <Glance label="Windows left" value={String(windows.length)} />
      </div>

      {allDay.length > 0 && (
        <ul className="space-y-1">
          {allDay.map((e) => (
            <li key={e.id} className="rounded-xl border border-subtle px-3 py-2 text-sm text-muted-foreground">
              All day · <span className="text-foreground">{e.title}</span>
            </li>
          ))}
        </ul>
      )}

      <Timeline events={timed} slots={slots} isToday={isToday} now={now} dayKey={localDateKey(day)} />

      <AddBlock day={day} />
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <span className="sr-only">Loading</span>
      <div className="h-5 w-16 animate-pulse rounded bg-secondary" />
      <div className="h-8 w-56 animate-pulse rounded bg-secondary" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary" />)}
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={cn("animate-pulse rounded-2xl bg-secondary", i % 2 ? "h-14" : "h-20")} />
      ))}
    </div>
  );
}

function Glance({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-subtle bg-card px-2 py-3">
      <div className="text-lg font-semibold tabular">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function MorningCheck({ dayKey }: { dayKey: string }) {
  const qc = useQueryClient();
  return (
    <Card className="space-y-3">
      <p className="font-semibold">Energy this morning?</p>
      <EnergyPicker
        label="Morning energy"
        value={null}
        onChange={(v) => {
          enqueue("energy_ratings", {
            id: crypto.randomUUID(),
            kind: "morning",
            rating: v,
            local_date: dayKey,
            at: new Date().toISOString(),
          });
          qc.invalidateQueries({ queryKey: ["daylogs", dayKey] });
          toast.success("Noted.");
        }}
      />
    </Card>
  );
}

function PrimeCards({ events, leadMin, now, primedIds }: { events: DayEvent[]; leadMin: number; now: number; primedIds: Set<string | null> }) {
  const due = events.filter((e) => {
    const s = new Date(e.start).getTime();
    return e.stressful && !primedIds.has(e.id) && now >= s - leadMin * 60_000 && now < s;
  });
  if (!due.length) return null;
  return (
    <>
      {due.map((e) => {
        const mins = Math.max(1, Math.round((new Date(e.start).getTime() - now) / 60000));
        return (
          <Card key={e.id} className="border-primary shadow-glow animate-metronome">
            <p className="font-semibold">Big one {mins <= leadMin ? `in ${mins} minutes` : `at ${fmtTime(e.start)}`}. Two minutes to settle?</p>
            <Button asChild className="mt-3 w-full">
              <Link to="/prime" search={{ event: e.id, at: e.start }}>
                <Wind /> Prime
              </Link>
            </Button>
          </Card>
        );
      })}
    </>
  );
}

function AfterMeetingCards({ events, now, rated, primed, dayKey }: { events: DayEvent[]; now: number; rated: Set<string | null>; primed: Set<string | null>; dayKey: string }) {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`tempo.dismiss.${dayKey}`) ?? "[]");
    } catch {
      return [];
    }
  });
  const [note, setNote] = useState<Record<string, string>>({});
  const due = events.filter((e) => e.stressful && new Date(e.end).getTime() <= now && !rated.has(e.id) && !dismissed.includes(e.id));
  if (!due.length) return null;
  const e = due[due.length - 1]!;
  const dismiss = () => {
    const next = [...dismissed, e.id];
    setDismissed(next);
    localStorage.setItem(`tempo.dismiss.${dayKey}`, JSON.stringify(next));
  };
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between">
        <p className="font-semibold">How did that land?</p>
        <button onClick={dismiss} className="tap -mr-2 -mt-3 text-sm text-muted-foreground underline" aria-label="Dismiss">
          Dismiss
        </button>
      </div>
      <p className="text-sm text-muted-foreground">{e.title} · {fmtTime(e.end)}</p>
      <Input aria-label="Optional note" placeholder="One line, if you like" maxLength={200} className="h-12" value={note[e.id] ?? ""} onChange={(x) => setNote({ ...note, [e.id]: x.target.value })} />
      <EnergyPicker
        label="Energy after the meeting"
        value={null}
        onChange={(v) => {
          enqueue("energy_ratings", {
            id: crypto.randomUUID(),
            kind: "after_meeting",
            rating: v,
            note: note[e.id]?.trim() || null,
            event_id: e.id,
            primed: primed.has(e.id),
            local_date: dayKey,
            at: new Date().toISOString(),
          });
          qc.invalidateQueries({ queryKey: ["daylogs", dayKey] });
        }}
      />
    </Card>
  );
}

function Timeline({ events, slots, isToday, now, dayKey }: { events: DayEvent[]; slots: Slot[]; isToday: boolean; now: number; dayKey: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: async (e: DayEvent) => {
      const { error } = await supabase
        .from("event_flags")
        .upsert({ event_id: e.id, stressful: !e.stressful, start_at: e.start, end_at: e.end }, { onConflict: "user_id,event_id" });
      if (error) throw error;
    },
    onError: () => toast.error("Couldn't update that meeting. Try again."),
    onSettled: () => qc.invalidateQueries({ queryKey: ["event_flags", dayKey] }),
  });
  const removeBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("manual_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onError: () => toast.error("Couldn't remove that block."),
    onSettled: () => qc.invalidateQueries({ queryKey: ["manual_blocks", dayKey] }),
  });

  type Item = { t: number; kind: "slot"; slot: Slot } | { t: number; kind: "event"; e: DayEvent };
  const items: Item[] = [
    ...slots.filter((s) => s.minutes >= 5).map((slot) => ({ t: slot.start.getTime(), kind: "slot" as const, slot })),
    ...events.map((e) => ({ t: new Date(e.start).getTime(), kind: "event" as const, e })),
  ].sort((a, b) => a.t - b.t);

  if (!items.length) return <p className="text-muted-foreground">No working hours left today.</p>;

  return (
    <ol className="relative space-y-2 border-l-2 border-subtle pl-4" aria-label="Timeline">
      {items.map((it) =>
        it.kind === "slot" ? (
          <li key={`s${it.t}`}>
            {it.slot.isWindow ? (
              <button
                disabled={!isToday}
                onClick={() =>
                  navigate({
                    to: "/focus",
                    search: { minutes: sessionLengthForWindow(it.slot, new Date(now)), until: it.slot.end.toISOString() },
                  })
                }
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition-colors disabled:cursor-default",
                  it.slot.best ? "border-primary bg-accent shadow-glow" : "border-border bg-card hover:bg-accent",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Clear run · {fmtDuration(it.slot.minutes)}</span>
                  {it.slot.best && <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-gold-foreground">Best window</span>}
                </div>
                <span className="text-sm text-muted-foreground tabular">
                  {fmtTime(it.slot.start)}–{fmtTime(it.slot.end)}
                  {isToday && " · tap to focus"}
                </span>
              </button>
            ) : (
              <p className="py-1 text-sm text-muted-foreground tabular">
                {fmtTime(it.slot.start)} · {fmtDuration(it.slot.minutes)} gap
              </p>
            )}
          </li>
        ) : (
          <li key={it.e.id}>
            <div className={cn("flex items-center gap-2 rounded-2xl border bg-secondary p-3", it.e.stressful ? "border-gold-text" : "border-subtle")}>
              <button
                className="flex-1 text-left"
                disabled={it.e.kind !== "meeting"}
                onClick={() => toggle.mutate(it.e)}
                aria-label={it.e.kind === "meeting" ? `${it.e.title}. ${it.e.stressful ? "Marked stressful. Tap to unmark." : "Tap to mark stressful."}` : undefined}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {it.e.stressful && <Zap className="h-4 w-4 text-gold-text" aria-hidden />}
                  {it.e.title}
                </div>
                <div className="text-sm text-muted-foreground tabular">
                  {fmtTime(it.e.start)}–{fmtTime(it.e.end)}
                  {it.e.stressful && " · stressful"}
                </div>
              </button>
              {it.e.source === "manual" && (
                <Button variant="ghost" size="sm" onClick={() => removeBlock.mutate(it.e.id.replace("manual:", ""))}>
                  Remove
                </Button>
              )}
            </div>
          </li>
        ),
      )}
    </ol>
  );
}

function AddBlock({ day }: { day: Date }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"meeting" | "focus">("meeting");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:00");
  const add = useMutation({
    mutationFn: async () => {
      const s = atLocal(day, start);
      const e = atLocal(day, end);
      if (e <= s) throw new Error("order");
      const { error } = await supabase.from("manual_blocks").insert({ kind, start_at: s.toISOString(), end_at: e.toISOString() });
      if (error) throw error;
    },
    onSuccess: () => setOpen(false),
    onError: (e) => toast.error(e.message === "order" ? "End needs to be after start." : "Couldn't add that block."),
    onSettled: () => qc.invalidateQueries({ queryKey: ["manual_blocks", localDateKey(day)] }),
  });
  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus /> Add a block
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a block</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Block type">
            {(["meeting", "focus"] as const).map((k) => (
              <Button key={k} role="radio" aria-checked={kind === k} variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>
                {k === "meeting" ? "Meeting" : "Focus"}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bs">Start</Label>
              <Input id="bs" type="time" className="h-12" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="be">End</Label>
              <Input id="be" type="time" className="h-12" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <Button size="lg" disabled={add.isPending} onClick={() => add.mutate()}>Add</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}


