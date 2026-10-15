import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useSettings, useSaveSettings, type Settings } from "@/lib/settings";
import { PATTERNS, phaseAt, type BreathPattern } from "@/lib/breath";
import { BreathCues } from "@/lib/breath-cues";
import { setImmersive } from "@/lib/immersive";
import { useDayEvents } from "@/lib/day-data";
import { enqueue } from "@/lib/offline-queue";
import { fmtTime, localDateKey } from "@/lib/timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageTitle, ScreenSkeleton } from "@/components/tempo/bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/prime")({
  validateSearch: z.object({ event: z.string().optional(), at: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Prime · Tempo" },
      { name: "description", content: "Two minutes of breathing before a big meeting." },
      { property: "og:title", content: "Prime · Tempo" },
      { property: "og:description", content: "Two minutes of breathing before a big meeting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Prime,
});

function Prime() {
  const { data: settings } = useSettings();
  if (!settings) return <ScreenSkeleton rows={3} />;
  return <PrimeInner settings={settings} />;
}

function MeetingContext({ eventId, at, keywords }: { eventId: string; at?: string; keywords: string[] }) {
  const date = at ? new Date(at) : new Date();
  const { events } = useDayEvents(Number.isFinite(date.getTime()) ? date : new Date(), keywords);
  const meeting = events.find((e) => e.id === eventId);
  const start = meeting?.start ?? at;
  return <p className="break-words text-muted-foreground">{meeting?.title ?? "Your meeting"}{start && Number.isFinite(new Date(start).getTime()) ? ` · ${fmtTime(start)}` : ""}</p>;
}

function PrimeInner({ settings }: { settings: Settings }) {
  const { event, at } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useSaveSettings();
  const [pattern, setPattern] = useState<BreathPattern>(settings.breath_pattern in PATTERNS ? settings.breath_pattern as BreathPattern : "sigh");
  const [minutes, setMinutes] = useState(settings.breath_minutes);
  const [stage, setStage] = useState<"choose" | "breathe" | "intent">("choose");
  const [startedAt, setStartedAt] = useState(0);
  const [t, setT] = useState(0);
  const [intent, setIntent] = useState("");
  const cues = useRef<BreathCues | null>(null);
  const lastPhase = useRef(-1);
  const cur = phaseAt(pattern, t);

  function stopCues() {
    cues.current?.stop();
    cues.current = null;
  }

  useEffect(() => {
    if (stage !== "breathe") return;
    setImmersive(true);
    document.documentElement.classList.add("prime-room");
    const visibility = () => { if (document.visibilityState === "hidden") stopCues(); };
    document.addEventListener("visibilitychange", visibility);
    const tick = () => {
      const elapsed = Math.min(minutes * 60, (Date.now() - startedAt) / 1000);
      setT(elapsed);
      if (elapsed >= minutes * 60) {
        stopCues();
        setStage("intent");
      }
    };
    const id = window.setInterval(tick, 100);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", visibility);
      stopCues();
      setImmersive(false);
      document.documentElement.classList.remove("prime-room");
    };
  }, [stage, startedAt, minutes]);

  useEffect(() => {
    if (stage !== "breathe" || cur.occurrence === lastPhase.current) return;
    lastPhase.current = cur.occurrence;
    cues.current?.phase(cur.phase.kind, cur.remaining);
  }, [cur.occurrence, cur.phase.kind, cur.remaining, stage]);

  function begin() {
    stopCues();
    // AudioContext creation and resume happen in this user gesture.
    cues.current = new BreathCues(settings.eyes_closed, settings.vibration);
    const first = phaseAt(pattern, 0);
    cues.current.phase(first.phase.kind, first.remaining);
    lastPhase.current = first.occurrence;
    setStartedAt(Date.now());
    setT(0);
    setStage("breathe");
  }

  function finishEarly() {
    stopCues();
    setT(Math.min(minutes * 60, (Date.now() - startedAt) / 1000));
    setStage("intent");
  }

  function finish() {
    enqueue("prime_sessions", {
      id: crypto.randomUUID(), event_id: event ?? null, pattern,
      duration_s: Math.round(Math.min(t, minutes * 60)),
      intention: intent.trim().slice(0, 200) || null,
      at: new Date().toISOString(),
    });
    void qc.invalidateQueries({ queryKey: ["daylogs", localDateKey(new Date())] });
    void qc.invalidateQueries({ queryKey: ["insights"] });
    void qc.invalidateQueries({ queryKey: ["history"] });
    void navigate({ to: "/today" });
  }

  if (stage === "choose") return (
    <div className="space-y-5">
      <PageTitle>{at && Number.isFinite(new Date(at).getTime()) ? `Before ${fmtTime(at)}` : "Prime"}</PageTitle>
      <div className="grid gap-2" role="radiogroup" aria-label="Breathing pattern">
        {(Object.keys(PATTERNS) as BreathPattern[]).map((p) => (
          <Button key={p} variant="outline" role="radio" aria-checked={pattern === p} onClick={() => setPattern(p)}
            className={cn("h-auto flex-col items-start gap-0 rounded-2xl p-4 text-left whitespace-normal", pattern === p ? "border-primary bg-accent" : "border-border bg-card")}>
            <span className="font-semibold">{PATTERNS[p].name}</span>
            <span className="text-sm font-normal text-muted-foreground">{PATTERNS[p].blurb}</span>
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Minutes">
        {[1, 2, 3, 4, 5].map((m) => (
          <Button key={m} variant="outline" role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)}
            className={cn("px-0 tabular", minutes === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>{m}m</Button>
        ))}
      </div>
      <div className="flex min-h-12 items-center justify-between gap-4">
        <Label htmlFor="eyes-closed">Eyes-closed mode</Label>
        <Switch id="eyes-closed" checked={settings.eyes_closed} disabled={save.isPending} onCheckedChange={(value) => save.mutate({ eyes_closed: value })} />
      </div>
      <Button size="lg" className="w-full" onClick={begin}>Begin</Button>
      <p className="text-center text-sm text-muted-foreground">Breathe gently. Stop if you feel dizzy.</p>
    </div>
  );

  if (stage === "breathe") {
    const left = Math.max(0, Math.ceil(minutes * 60 - t));
    const motion = { "--breath-from": cur.fromScale, "--breath-to": cur.phase.scale, "--phase-duration": `${cur.phase.seconds}s` } as CSSProperties;
    return (
      <section className="prime-breathing flex flex-col items-center justify-center gap-6 text-center" aria-label="Breathing session">
        <div className="prime-phase relative flex w-full max-w-72 aspect-square items-center justify-center">
          <div key={cur.occurrence} aria-hidden="true" className="breath-circle absolute inset-0 rounded-full border-2 border-primary bg-accent" style={motion}>
            {cur.phase.kind === "hold" && <svg className="absolute inset-0 h-full w-full -rotate-90 text-primary" viewBox="0 0 100 100">
              <circle className="breath-hold-ring" cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1" pathLength="1" />
            </svg>}
          </div>
          <div className="relative space-y-1">
            <div role="status" aria-live="polite" aria-atomic="true" className="text-2xl font-semibold">{cur.phase.label}</div>
            <div aria-hidden="true" className="text-muted-foreground tabular">{Math.ceil(cur.remaining)}</div>
          </div>
        </div>
        <progress className="breath-reduced-progress w-full max-w-72" aria-label={`${cur.phase.label} progress`} value={cur.progress} max={1} />
        <ol className="flex flex-wrap justify-center gap-3" aria-label="Breathing phases">
          {PATTERNS[pattern].phases.map((phase, index) => (
            <li key={index} aria-current={index === cur.index ? "step" : undefined} className={cn("flex flex-col items-center gap-1 text-xs", index === cur.index ? "text-accent-text" : "text-muted-foreground")}>
              <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", index === cur.index ? "bg-primary" : index === cur.nextIndex ? "border border-primary bg-accent" : "bg-muted-foreground/40")} />
              <span>{phase.label}</span>
            </li>
          ))}
        </ol>
        <p className="tabular text-muted-foreground">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left</p>
        <p className="text-sm text-muted-foreground">Breathe gently. Stop if you feel dizzy.</p>
        <Button variant="ghost" className="shrink-0" onClick={finishEarly}>Finish early</Button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <PageTitle>Settled.</PageTitle>
        {event && <MeetingContext eventId={event} at={at} keywords={settings.keywords} />}
        <p>You're ready. Walk in steady.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pi">One thing I want from this</Label>
        <Input id="pi" name="intention" maxLength={200} className="h-12 text-base" placeholder="Optional" value={intent} onChange={(e) => setIntent(e.target.value)} />
      </div>
      <Button size="lg" variant="gold" className="w-full" onClick={finish}>Done</Button>
    </div>
  );
}
