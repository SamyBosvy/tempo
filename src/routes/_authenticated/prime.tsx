import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useSettings } from "@/lib/settings";
import { PATTERNS, phaseAt, type BreathPattern } from "@/lib/breath";
import { enqueue } from "@/lib/offline-queue";
import { fmtTime, localDateKey } from "@/lib/timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    ],
  }),
  component: Prime,
});

function Prime() {
  const { data: settings } = useSettings();
  if (!settings) return <ScreenSkeleton rows={3} />;
  return <PrimeInner defaultPattern={settings.breath_pattern as BreathPattern} defaultMin={settings.breath_minutes} vibrate={settings.vibration} />;
}

function PrimeInner({ defaultPattern, defaultMin, vibrate }: { defaultPattern: BreathPattern; defaultMin: number; vibrate: boolean }) {
  const { event, at } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pattern, setPattern] = useState<BreathPattern>(defaultPattern);
  const [minutes, setMinutes] = useState(defaultMin);
  const [stage, setStage] = useState<"choose" | "breathe" | "intent">("choose");
  const [startedAt, setStartedAt] = useState(0);
  const [t, setT] = useState(0);
  const [intent, setIntent] = useState("");
  const lastPhase = useRef(-1);

  useEffect(() => {
    if (stage !== "breathe") return;
    const id = window.setInterval(() => {
      const el = (Date.now() - startedAt) / 1000;
      setT(el);
      if (el >= minutes * 60) setStage("intent");
    }, 100);
    return () => window.clearInterval(id);
  }, [stage, startedAt, minutes]);

  const cur = phaseAt(pattern, t);
  useEffect(() => {
    if (stage !== "breathe") return;
    if (cur.index !== lastPhase.current) {
      lastPhase.current = cur.index;
      if (vibrate && "vibrate" in navigator) navigator.vibrate?.(40);
    }
  }, [cur.index, stage, vibrate]);

  function finish() {
    enqueue("prime_sessions", {
      id: crypto.randomUUID(),
      event_id: event ?? null,
      pattern,
      duration_s: Math.round(Math.min(t, minutes * 60)),
      intention: intent.trim().slice(0, 200) || null,
      at: new Date().toISOString(),
    });
    qc.invalidateQueries({ queryKey: ["daylogs", localDateKey(new Date())] });
    navigate({ to: "/today" });
  }

  if (stage === "choose")
    return (
      <div className="space-y-5">
        <PageTitle>{at ? `Before ${fmtTime(at)}` : "Prime"}</PageTitle>
        <div className="grid gap-2" role="radiogroup" aria-label="Breathing pattern">
          {(Object.keys(PATTERNS) as BreathPattern[]).map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={pattern === p}
              onClick={() => setPattern(p)}
              className={cn("rounded-2xl border p-4 text-left", pattern === p ? "border-primary bg-accent" : "border-border bg-card")}
            >
              <div className="font-semibold">{PATTERNS[p].name}</div>
              <div className="text-sm text-muted-foreground">{PATTERNS[p].blurb}</div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Minutes">
          {[1, 2, 3, 4, 5].map((m) => (
            <button key={m} role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)}
              className={cn("tap rounded-xl border font-semibold tabular", minutes === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
              {m}m
            </button>
          ))}
        </div>
        <Button size="lg" className="w-full" onClick={() => { setStartedAt(Date.now()); setT(0); setStage("breathe"); }}>Begin</Button>
        <p className="text-center text-sm text-muted-foreground">Breathe gently. Stop if you feel dizzy.</p>
      </div>
    );

  if (stage === "breathe") {
    const left = Math.max(0, Math.ceil(minutes * 60 - t));
    return (
      <div className="flex flex-col items-center space-y-8 pt-8 text-center">
        <div className="relative flex h-72 w-72 items-center justify-center">
          <div
            aria-hidden
            className="absolute rounded-full bg-accent border-2 border-primary"
            style={{ width: "100%", height: "100%", transform: `scale(${cur.phase.scale})`, transition: `transform ${cur.phase.seconds}s ease-in-out` }}
          />
          <div className="relative" aria-live="polite">
            <div className="text-2xl font-semibold">{cur.phase.label}</div>
            <div className="text-muted-foreground tabular">{Math.ceil(cur.remaining)}</div>
          </div>
        </div>
        <p className="tabular text-muted-foreground">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left</p>
        <p className="text-sm text-muted-foreground">Breathe gently. Stop if you feel dizzy.</p>
        <Button variant="ghost" onClick={() => setStage("intent")}>Finish early</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageTitle>Settled.</PageTitle>
      <div className="space-y-1.5">
        <Label htmlFor="pi">One thing I want from this</Label>
        <Input id="pi" maxLength={200} className="h-12 text-base" placeholder="Optional" value={intent} onChange={(e) => setIntent(e.target.value)} />
      </div>
      <Button size="lg" variant="gold" className="w-full" onClick={finish}>Done</Button>
    </div>
  );
}
