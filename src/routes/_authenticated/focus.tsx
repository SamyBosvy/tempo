import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Square, Hand } from "lucide-react";
import { focusTimer, elapsedMs, useFocusState, type Interruption } from "@/lib/focus-timer";
import { enqueue } from "@/lib/offline-queue";
import { useNow } from "@/lib/use-now";
import { fmtTime, localDateKey } from "@/lib/timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, EnergyPicker, PageTitle } from "@/components/tempo/bits";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/focus")({
  validateSearch: z.object({
    minutes: z.coerce.number().int().min(5).max(600).optional(),
    until: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Focus · Tempo" },
      { name: "description", content: "A calm countdown for deep work." },
      { property: "og:title", content: "Focus · Tempo" },
      { property: "og:description", content: "A calm countdown for deep work." },
    ],
  }),
  component: Focus,
});

const REASONS: { id: Interruption["reason"]; label: string }[] = [
  { id: "meeting", label: "Meeting ran over" },
  { id: "message", label: "Message/phone" },
  { id: "distracted", label: "Distracted" },
  { id: "other", label: "Other" },
];

type Done = { minutes: number; before: number | null; after: number | null };

function Focus() {
  const state = useFocusState();
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  if (done) return <DoneMoment done={done} onClose={() => setDone(null)} />;
  if (state && finishing) return <Finish onDone={(d) => { setFinishing(false); setDone(d); }} onBack={() => setFinishing(false)} />;
  if (state) return <Running onEnd={() => setFinishing(true)} />;
  return <Setup />;
}

function Setup() {
  const { minutes, until } = Route.useSearch();
  const [len, setLen] = useState<number>(minutes ?? 50);
  const [custom, setCustom] = useState(minutes && ![25, 50, 90].includes(minutes) ? String(minutes) : "");
  const [intention, setIntention] = useState("");
  const [energy, setEnergy] = useState<number | null>(null);
  const [step, setStep] = useState<"plan" | "energy">("plan");

  const begin = (e: number | null) =>
    focusTimer.start({ targetMin: len, intention: intention.trim().slice(0, 200), energyBefore: e, nextEventAt: until ?? null });

  if (step === "energy")
    return (
      <div className="space-y-6">
        <PageTitle>Energy before?</PageTitle>
        <EnergyPicker label="Energy before" value={energy} onChange={(v) => { setEnergy(v); begin(v); }} />
        <Button variant="ghost" className="w-full" onClick={() => begin(null)}>Skip</Button>
      </div>
    );

  return (
    <div className="space-y-5">
      <PageTitle>Focus</PageTitle>
      {until && <p className="text-muted-foreground">Sized to end 5 minutes before {fmtTime(until)}.</p>}
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Length">
        {[25, 50, 90].map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={len === m && !custom}
            onClick={() => { setLen(m); setCustom(""); }}
            className={cn(
              "tap h-16 rounded-2xl border text-lg font-semibold tabular",
              len === m && !custom ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
            )}
          >
            {m}m
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="custom">Custom minutes</Label>
        <Input
          id="custom"
          inputMode="numeric"
          className="h-12 text-base"
          value={custom}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 3);
            setCustom(v);
            if (Number(v) >= 5) setLen(Number(v));
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="intent">What's this block for?</Label>
        <Input id="intent" maxLength={200} className="h-12 text-base" value={intention} onChange={(e) => setIntention(e.target.value)} placeholder="Optional" />
      </div>
      <Button size="lg" className="w-full" onClick={() => setStep("energy")}>
        Start {len} min
      </Button>
    </div>
  );
}

function Running({ onEnd }: { onEnd: () => void }) {
  const s = useFocusState()!;
  const now = useNow(1000);
  const [interrupt, setInterrupt] = useState(false);
  const [staleOpen, setStaleOpen] = useState(false);
  const [adjust, setAdjust] = useState("");
  const el = elapsedMs(s, now);
  const remaining = Math.max(0, s.targetMin * 60_000 - el);
  const progress = Math.min(1, el / (s.targetMin * 60_000));
  const stale = el > 3 * 3600_000;
  const warnAt = s.nextEventAt ? new Date(s.nextEventAt).getTime() : null;
  const warn = warnAt && now >= warnAt - 5 * 60_000 && now < warnAt + 60_000;

  useEffect(() => {
    if (stale) setStaleOpen(true);
  }, [stale]);
  useEffect(() => {
    if (remaining === 0 && !stale) onEnd();
  }, [remaining, stale, onEnd]);

  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const R = 120;
  const C = 2 * Math.PI * R;

  return (
    <div className="flex flex-col items-center space-y-6 pt-4">
      {s.intention && <p className="text-center text-lg text-muted-foreground">{s.intention}</p>}
      {warn && (
        <Card role="alert" className="w-full border-gold-text text-center font-semibold">
          Meeting at {fmtTime(new Date(warnAt!))}. Wrap up?
        </Card>
      )}
      <div className="relative h-72 w-72">
        <svg viewBox="0 0 260 260" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="130" cy="130" r={R} fill="none" stroke="var(--color-secondary)" strokeWidth="10" />
          <circle cx="130" cy="130" r={R} fill="none" stroke="var(--color-primary)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-display text-6xl font-semibold tabular", !s.paused && "animate-metronome")} role="timer" aria-live="off">
            {mm}:{String(ss).padStart(2, "0")}
          </span>
          <span className="text-sm text-muted-foreground">{s.paused ? "Paused" : `of ${s.targetMin} min`}</span>
        </div>
      </div>
      <div className="grid w-full grid-cols-3 gap-2">
        {s.paused ? (
          <Button size="lg" variant="secondary" onClick={() => focusTimer.resume()} aria-label="Resume"><Play /></Button>
        ) : (
          <Button size="lg" variant="secondary" onClick={() => focusTimer.pause()} aria-label="Pause"><Pause /></Button>
        )}
        <Button size="lg" variant="outline" onClick={() => setInterrupt(true)}>
          <Hand /> Interrupted
        </Button>
        <Button size="lg" onClick={onEnd} aria-label="End session"><Square /> End</Button>
      </div>
      {s.interruptions.length > 0 && (
        <p className="text-sm text-muted-foreground">{s.interruptions.length} interruption{s.interruptions.length > 1 ? "s" : ""} logged</p>
      )}

      <Dialog open={interrupt} onOpenChange={setInterrupt}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>What happened?</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            {REASONS.map((r) => (
              <Button key={r.id} variant="outline" onClick={() => { focusTimer.interrupt(r.id); setInterrupt(false); }}>
                {r.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={staleOpen} onOpenChange={setStaleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Still going?</DialogTitle>
            <DialogDescription>You left a session running for {Math.floor(el / 3600_000)}h. Save it, adjust the time, or discard?</DialogDescription>
          </DialogHeader>
          <Button onClick={() => { focusTimer.pause(); setStaleOpen(false); onEnd(); }}>Save it</Button>
          <div className="flex gap-2">
            <Input aria-label="Actual minutes" inputMode="numeric" placeholder="Minutes" className="h-12" value={adjust} onChange={(e) => setAdjust(e.target.value.replace(/\D/g, "").slice(0, 3))} />
            <Button variant="secondary" disabled={!Number(adjust)} onClick={() => { focusTimer.setElapsedMin(Number(adjust)); setStaleOpen(false); onEnd(); }}>Adjust</Button>
          </div>
          <Button variant="ghost" onClick={() => { focusTimer.clear(); setStaleOpen(false); }}>Discard</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Finish({ onDone, onBack }: { onDone: (d: Done) => void; onBack: () => void }) {
  const s = useFocusState()!;
  const qc = useQueryClient();
  const [after, setAfter] = useState<number | null>(null);
  const [note, setNote] = useState("");

  function save(a: number | null) {
    const end = Date.now();
    const minutes = Math.max(1, Math.round(elapsedMs(s, end) / 60000));
    const startedAt = new Date(s.sessionStart).toISOString();
    enqueue("focus_sessions", {
      id: s.id,
      started_at: startedAt,
      ended_at: new Date(Math.min(end, s.sessionStart + minutes * 60_000 + elapsedPauseGap(s, end))).toISOString(),
      planned_min: s.targetMin,
      actual_min: minutes,
      intention: s.intention || null,
      done_note: note.trim().slice(0, 200) || null,
      energy_before: s.energyBefore,
      energy_after: a,
    });
    for (const i of s.interruptions) enqueue("interruptions", { id: crypto.randomUUID(), session_id: s.id, reason: i.reason, at: i.at });
    focusTimer.clear();
    qc.invalidateQueries({ queryKey: ["daylogs", localDateKey(new Date(s.sessionStart))] });
    onDone({ minutes, before: s.energyBefore, after: a });
  }

  return (
    <div className="space-y-5">
      <PageTitle>Energy after?</PageTitle>
      <EnergyPicker label="Energy after" value={after} onChange={setAfter} />
      <div className="space-y-1.5">
        <Label htmlFor="got">What got done?</Label>
        <Input id="got" maxLength={200} className="h-12 text-base" placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button size="lg" variant="gold" className="w-full" onClick={() => save(after)}>Save session</Button>
      <Button variant="ghost" className="w-full" onClick={onBack}>Back to timer</Button>
    </div>
  );
}

function elapsedPauseGap(s: { sessionStart: number }, end: number) {
  return Math.max(0, end - s.sessionStart);
}

function DoneMoment({ done, onClose }: { done: Done; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center space-y-6 pt-16 text-center">
      <div className="h-32 w-32 rounded-full bg-gold animate-metronome" aria-hidden />
      <h1 className="text-3xl font-semibold text-gold-text">Session done.</h1>
      <p className="text-lg tabular">
        {done.minutes} min
        {done.before && done.after ? ` · energy ${done.before} → ${done.after}` : done.after ? ` · energy ${done.after}` : ""}
      </p>
      <Button size="lg" className="w-full" onClick={() => { onClose(); navigate({ to: "/today" }); }}>Back to today</Button>
    </div>
  );
}
