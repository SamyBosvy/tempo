import { EmptyState } from "@/components/tempo/EmptyState";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Square, Hand, Copy, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { breakTimer, elapsedMs, focusTimer, MAX_PARKED, PARKED_MAX_LEN, useBreakState, useFocusState, type InterruptReason } from "@/lib/focus-timer";
import { enqueue, pendingRows } from "@/lib/offline-queue";
import { tapHaptic } from "@/lib/haptics";
import { useNow } from "@/lib/use-now";
import { fmtTime, localDateKey } from "@/lib/timeline";
import { useDayEvents, useDayLogs } from "@/lib/day-data";
import { useSettings } from "@/lib/settings";
import { nextBusyAfter, recentIntentions, showRunningExtend, todaySummary } from "@/lib/focus-extras";
import { setImmersive } from "@/lib/immersive";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, EnergyPicker, PageTitle } from "@/components/tempo/bits";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { effectiveFocusMinutes, focusClock, MIN_FOCUS_MIN } from "@/lib/fix-rules";

export const Route = createFileRoute("/_authenticated/focus")({
  validateSearch: z.object({
    minutes: z.coerce.number().int().min(5).max(600).optional(),
    until: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { title: "Focus · Tempo" },
      { name: "description", content: "A calm countdown for deep work." },
      { property: "og:title", content: "Focus · Tempo" },
      { property: "og:description", content: "A calm countdown for deep work." },
    ],
  }),
  component: Focus,
});

const REASONS: { id: Exclude<InterruptReason, "custom">; label: string }[] = [
  { id: "meeting", label: "Meeting ran over" },
  { id: "message", label: "Message/phone" },
  { id: "distracted", label: "Distracted" },
  { id: "other", label: "Other" },
];

type Done = { minutes: number; before: number | null; after: number | null; planned: number };

function Focus() {
  const state = useFocusState();
  const brk = useBreakState();
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const { minutes } = Route.useSearch();

  if (done) return <DoneMoment done={done} onClose={() => { tapHaptic(); setDone(null); }} />;
  if (brk && !state) return <BreakScreen />;
  if (state && finishing) return <Finish onDone={(d) => { setFinishing(false); setDone(d); }} onBack={() => setFinishing(false)} />;
  if (state) return <Running onEnd={() => setFinishing(true)} />;
  return <Setup key={minutes ?? "none"} />;
}

function useRecentIntentions() {
  return useQuery({
    queryKey: ["recent_intentions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("focus_sessions")
        .select("intention, started_at")
        .not("intention", "is", null)
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const pending = pendingRows("focus_sessions") as { intention: string | null; started_at: string }[];
      return recentIntentions([...data, ...pending]);
    },
    staleTime: 60_000,
  });
}

function Setup() {
  const { minutes, until } = Route.useSearch();
  const { data: settings } = useSettings();
  const { events } = useDayEvents(new Date(), settings?.keywords ?? []);
  const recent = useRecentIntentions();
  const [len, setLen] = useState<number>(minutes ?? 50);
  const [custom, setCustom] = useState(minutes && ![25, 50, 90].includes(minutes) ? String(minutes) : "");
  const [intention, setIntention] = useState("");
  const [energy, setEnergy] = useState<number | null>(null);
  const [step, setStep] = useState<"plan" | "energy">("plan");
  const [hint, setHint] = useState(false);
  const effective = effectiveFocusMinutes(custom, len);

  const begin = (e: number | null) => {
    tapHaptic();
    focusTimer.start({
      targetMin: effective,
      intention: intention.trim().slice(0, 200),
      energyBefore: e,
      nextEventAt: until ?? nextBusyAfter(events, new Date()),
    });
  };

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
            setHint(false);
          }}
          onBlur={() => {
            if (custom && Number(custom) < MIN_FOCUS_MIN) {
              setCustom(String(MIN_FOCUS_MIN));
              setHint(true);
            }
          }}
          aria-describedby={hint ? "custom-hint" : undefined}
        />
        {hint && <p id="custom-hint" role="status" className="text-sm text-muted-foreground">Minimum is {MIN_FOCUS_MIN} minutes.</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="intent">What's this block for?</Label>
        <Input id="intent" maxLength={200} className="h-12 text-base" value={intention} onChange={(e) => setIntention(e.target.value)} placeholder="Optional" />
        {recent.data?.length === 0 && <EmptyState>Your next intention starts here.</EmptyState>}
        {!!recent.data?.length && (
          <div className="flex flex-wrap gap-2 pt-1" aria-label="Recent intentions">
            {recent.data.map((t) => (
              <button key={t} type="button" onClick={() => setIntention(t)}
                className="tap max-w-full truncate rounded-full border border-border bg-card px-4 text-sm font-medium">
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
      <Button size="lg" className="w-full" onClick={() => setStep("energy")}>
        Start {effective} min
      </Button>
    </div>
  );
}

function Running({ onEnd }: { onEnd: () => void }) {
  const s = useFocusState()!;
  const { data: settings } = useSettings();
  const now = useNow(1000);
  const [interrupt, setInterrupt] = useState(false);
  const [source, setSource] = useState<"self" | "external" | null>(null);
  const [parkOpen, setParkOpen] = useState(false);
  const [thought, setThought] = useState("");
  const [staleOpen, setStaleOpen] = useState(false);
  const [adjust, setAdjust] = useState("");
  const [reveal, setReveal] = useState(true);
  const hideT = useRef<number | undefined>(undefined);
  const el = elapsedMs(s, now);
  const remaining = Math.max(0, s.targetMin * 60_000 - el);
  const progress = Math.min(1, el / (s.targetMin * 60_000));
  const stale = el > 3 * 3600_000;
  const warnAt = s.nextEventAt ? new Date(s.nextEventAt).getTime() : null;
  const warn = warnAt && now >= warnAt - 5 * 60_000 && now < warnAt + 60_000;
  const parkedCount = s.parked?.length ?? 0;

  const showControls = () => {
    setReveal(true);
    window.clearTimeout(hideT.current);
    hideT.current = window.setTimeout(() => setReveal(false), 5000);
  };
  useEffect(() => {
    setImmersive(true);
    showControls();
    return () => {
      setImmersive(false);
      window.clearTimeout(hideT.current);
    };
  }, []);

  useEffect(() => {
    if (stale) setStaleOpen(true);
  }, [stale]);
  useEffect(() => {
    if (remaining === 0 && !stale && !s.overtime) {
      focusTimer.markOvertime();
      onEnd();
    }
  }, [remaining, stale, onEnd, s.overtime]);
  const R = 120;
  const C = 2 * Math.PI * R;
  const visible = reveal || s.paused || interrupt || parkOpen;

  function pick(reason: InterruptReason) {
    focusTimer.interrupt(reason, source ?? undefined, reason === "custom" ? settings?.custom_interruption : null);
    setInterrupt(false);
    setSource(null);
  }

  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col items-center space-y-6 pt-[max(env(safe-area-inset-top),0.5rem)]" onClick={showControls}>
      {s.intention && (
        <h1 className="line-clamp-2 w-full text-center font-display text-2xl font-semibold leading-tight text-foreground">{s.intention}</h1>
      )}
      {warn && (
        <Card role="alert" className="w-full border-gold-text text-center font-semibold">
          Meeting at {fmtTime(new Date(warnAt!))}. Wrap up?
        </Card>
      )}
      <div className="relative aspect-square w-[min(18rem,80vw)]">
        <svg viewBox="0 0 260 260" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="130" cy="130" r={R} fill="none" stroke="var(--color-secondary)" strokeWidth="10" />
          <circle cx="130" cy="130" r={R} fill="none" stroke="var(--color-primary)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[clamp(2rem,14vw,3.75rem)] font-semibold tabular" role="timer" aria-live="off">
            {focusClock(el, s.targetMin)}
          </span>
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            {!s.paused && <span className="h-2 w-2 rounded-full bg-primary animate-tick" aria-hidden />}
            {s.paused ? "Paused" : remaining === 0 ? "Overtime" : `of ${s.targetMin} min`}
          </span>
        </div>
      </div>

      {s.paused && (
        <Button size="lg" variant="secondary" className="w-full" onClick={(e) => { e.stopPropagation(); focusTimer.resume(); }}>
          Paused · Resume
        </Button>
      )}

      <div
        className={cn("w-full space-y-3 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100", visible ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={(e) => { e.stopPropagation(); showControls(); }}
      >
        {showRunningExtend(remaining) && !s.paused && (
          <Button variant="outline" className="mx-auto flex" onClick={() => focusTimer.extend(5)}>+5 min</Button>
        )}
        <div className="grid w-full grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)] gap-2">
          {s.paused ? (
            <Button size="lg" variant="secondary" className="w-16 shrink-0 px-0" onClick={() => focusTimer.resume()} aria-label="Resume"><Play /></Button>
          ) : (
            <Button size="lg" variant="secondary" className="w-16 shrink-0 px-0" onClick={() => focusTimer.pause()} aria-label="Pause"><Pause /></Button>
          )}
          <Button size="lg" variant="outline" className="min-w-0 gap-1.5 px-2 text-base [&_svg]:size-4 min-[390px]:gap-2 min-[390px]:[&_svg]:size-5" onClick={() => setInterrupt(true)}>
            <Hand /> Interrupted
          </Button>
          <Button size="lg" className="min-w-0 gap-1.5 px-2 text-base [&_svg]:size-4 min-[390px]:gap-2 min-[390px]:[&_svg]:size-5" onClick={onEnd} aria-label="End session"><Square /> End</Button>
        </div>
        <Button variant="ghost" className="w-full" disabled={parkedCount >= MAX_PARKED} onClick={() => setParkOpen(true)}>
          <NotebookPen /> Park a thought{parkedCount ? ` (${parkedCount})` : ""}
        </Button>
        {s.interruptions.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">{s.interruptions.length} interruption{s.interruptions.length > 1 ? "s" : ""} logged</p>
        )}
      </div>
      {!visible && <p className="sr-only-safe">Tap the screen to show controls.</p>}

      <Dialog open={interrupt} onOpenChange={(o) => { setInterrupt(o); if (!o) setSource(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>What happened?</DialogTitle>
            <DialogDescription>{source ? "The timer pauses so this doesn't count as focus." : "Did it come from you or from outside?"}</DialogDescription>
          </DialogHeader>
          {!source ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setSource("self")}>Self</Button>
              <Button variant="outline" onClick={() => setSource("external")}>External</Button>
            </div>
          ) : (
            <div className="grid gap-2">
              {REASONS.map((r) => (
                <Button key={r.id} variant="outline" onClick={() => pick(r.id)}>{r.label}</Button>
              ))}
              {settings?.custom_interruption && (
                <Button variant="outline" onClick={() => pick("custom")}>{settings.custom_interruption}</Button>
              )}
              <Button variant="ghost" onClick={() => setSource(null)}>Back</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={parkOpen} onOpenChange={setParkOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Park a thought</DialogTitle>
            <DialogDescription>It waits for you at the end. The timer keeps going.</DialogDescription>
          </DialogHeader>
          <form id="park-form" onSubmit={(e) => {
            e.preventDefault();
            if (focusTimer.park(thought)) { setThought(""); setParkOpen(false); }
          }}>
            <Label htmlFor="thought" className="sr-only">Thought</Label>
            <Input id="thought" autoFocus maxLength={PARKED_MAX_LEN} className="h-12 text-base" value={thought} onChange={(e) => setThought(e.target.value)} placeholder="One line" />
          </form>
          <DialogFooter>
            <Button variant="ghost" className="h-12" onClick={() => setParkOpen(false)}>Cancel</Button>
            <Button type="submit" form="park-form" className="h-12" disabled={!thought.trim()}>Park it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={staleOpen} onOpenChange={setStaleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Still going?</DialogTitle>
            <DialogDescription>You left a session running for {Math.floor(el / 3600_000)}h. Save it, adjust the time, or discard?</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input aria-label="Actual minutes" inputMode="numeric" placeholder="Minutes" className="h-12" value={adjust} onChange={(e) => setAdjust(e.target.value.replace(/\D/g, "").slice(0, 3))} />
            <Button variant="secondary" disabled={!Number(adjust)} onClick={() => { focusTimer.setElapsedMin(Number(adjust)); setStaleOpen(false); onEnd(); }}>Adjust</Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="h-12" onClick={() => { focusTimer.clear(); setStaleOpen(false); }}>Discard</Button>
            <Button className="h-12" onClick={() => { focusTimer.pause(); setStaleOpen(false); onEnd(); }}>Save it</Button>
          </DialogFooter>
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
  const timeUp = elapsedMs(s) >= s.targetMin * 60_000;
  const parked = s.parked ?? [];

  function save(a: number | null) {
    const end = Date.now();
    const minutes = Math.max(1, Math.round(elapsedMs(s, end) / 60000));
    const startedAt = new Date(s.sessionStart).toISOString();
    enqueue("focus_sessions", {
      id: s.id,
      started_at: startedAt,
      ended_at: new Date(end).toISOString(),
      planned_min: s.targetMin,
      actual_min: minutes,
      intention: s.intention || null,
      done_note: note.trim().slice(0, 200) || null,
      energy_before: s.energyBefore,
      energy_after: a,
      parked_thoughts: parked.length ? parked.slice(0, MAX_PARKED) : null,
    });
    for (const i of s.interruptions)
      enqueue("interruptions", {
        id: crypto.randomUUID(),
        session_id: s.id,
        reason: i.reason,
        source: i.source ?? null,
        custom_label: i.reason === "custom" ? i.customLabel || "Custom" : null,
        at: i.at,
      });
    focusTimer.clear();
    qc.invalidateQueries({ queryKey: ["daylogs", localDateKey(new Date(s.sessionStart))] });
    qc.invalidateQueries({ queryKey: ["recent_intentions"] });
    onDone({ minutes, before: s.energyBefore, after: a, planned: s.targetMin });
  }

  async function copy(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      toast.success("Copied.");
    } catch {
      toast.error("Couldn't copy. Select the text instead.");
    }
  }

  return (
    <div className="space-y-5">
      <PageTitle>Energy after?</PageTitle>
      <EnergyPicker label="Energy after" value={after} onChange={setAfter} />
      <div className="space-y-1.5">
        <Label htmlFor="got">What got done?</Label>
        <Input id="got" maxLength={200} className="h-12 text-base" placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {parked.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-semibold">Parked thoughts</h2>
          <ul className="space-y-2">
            {parked.map((t, i) => (
              <li key={i} className="flex items-start justify-between gap-2">
                <span className="min-w-0 break-words pt-3">{t}</span>
                <Button variant="ghost" size="icon" aria-label={`Copy: ${t}`} onClick={() => void copy(t)}><Copy /></Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Button size="lg" variant="gold" className="w-full" onClick={() => { tapHaptic(); save(after); }}>Save session</Button>
      {timeUp && (
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" onClick={() => { focusTimer.extend(5); onBack(); }}>+5 min</Button>
          <Button variant="secondary" onClick={() => { focusTimer.extend(15); onBack(); }}>+15 min</Button>
          <Button variant="secondary" onClick={() => { focusTimer.keepGoing(); onBack(); }}>Keep going</Button>
        </div>
      )}
      <Button variant="ghost" className="w-full" onClick={() => { if (timeUp) focusTimer.keepGoing(); onBack(); }}>Back to timer</Button>
    </div>
  );
}

function DoneMoment({ done, onClose }: { done: Done; onClose: () => void }) {
  const navigate = useNavigate();
  const logs = useDayLogs(new Date());
  const R = 56;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-center space-y-6 pt-12 text-center">
      <svg viewBox="0 0 128 128" className="h-32 w-32 -rotate-90" aria-hidden>
        <circle cx="64" cy="64" r={R} fill="none" stroke="var(--color-secondary)" strokeWidth="8" />
        <circle cx="64" cy="64" r={R} fill="none" stroke="var(--color-gold)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={C} className="ring-close" style={{ ["--ring-c" as string]: C }} />
      </svg>
      <h1 className="text-3xl font-semibold text-gold-text">Session done.</h1>
      <p className="text-lg tabular">
        {done.minutes} min
        {done.before && done.after ? ` · energy ${done.before} → ${done.after}` : done.after ? ` · energy ${done.after}` : ""}
      </p>
      {logs.data && <p className="text-muted-foreground tabular" role="status">{todaySummary(logs.data.sessions)}</p>}
      <div className="w-full space-y-2">
        <div className="grid gap-2">
          <Button size="lg" variant="secondary" className="h-auto min-h-12 whitespace-normal" onClick={() => { breakTimer.start(5, done.planned); onClose(); }}>Take a 5 min break</Button>
          <Button size="lg" variant="secondary" className="h-auto min-h-12 whitespace-normal" onClick={() => { breakTimer.start(10, done.planned); onClose(); }}>Take a 10 min break</Button>
        </div>
        <Button size="lg" variant="ghost" className="h-auto min-h-12 w-full whitespace-normal" onClick={() => { onClose(); navigate({ to: "/today" }); }}>Skip</Button>
      </div>
    </div>
  );
}

function BreakScreen() {
  const b = useBreakState()!;
  const now = useNow(1000);
  const navigate = useNavigate();
  const left = Math.max(0, b.endsAt - now);
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  if (left === 0)
    return (
      <div className="flex flex-col items-center space-y-6 pt-16 text-center">
        <h1 className="font-display text-3xl font-semibold">Ready for the next one?</h1>
        <Button size="lg" className="w-full" onClick={() => { breakTimer.clear(); navigate({ to: "/focus", search: { minutes: b.lastLen } }); }}>
          Start focus · {b.lastLen} min
        </Button>
        <Button size="lg" variant="ghost" className="w-full" onClick={() => { breakTimer.clear(); navigate({ to: "/today" }); }}>Back to today</Button>
      </div>
    );
  return (
    <div className="flex flex-col items-center space-y-6 pt-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-gold-text">Break</p>
      <span className="font-display text-6xl font-semibold tabular text-gold-text" role="timer" aria-live="off">
        {mm}:{String(ss).padStart(2, "0")}
      </span>
      <p className="text-muted-foreground">Step away from the screen. This isn't logged as focus.</p>
      <Button variant="ghost" className="w-full" onClick={() => breakTimer.clear()}>End break</Button>
    </div>
  );
}
