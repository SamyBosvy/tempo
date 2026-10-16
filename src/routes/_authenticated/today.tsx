import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Settings as Gear, Plus, Wind, Zap, CalendarOff, MoreHorizontal, Play, Repeat } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCalendarList } from "@/lib/google.functions";
import { workWindow } from "@/lib/work-hours";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/lib/settings";
import { afterMeetingRating, INTENT_OUTCOMES, primeIntents, type IntentOutcome } from "@/lib/checkin";
import { useCheckinDismissals, useDayEvents, useDayLogs, type DayEvent, type StressReason } from "@/lib/day-data";
import {
  atLocal,
  backToBackRun,
  computeSlots,
  EVERY_DAY,
  fmtDuration,
  fmtMinutesShort,
  fmtTime,
  localDateKey,
  meetingMinutes,
  nowFraction,
  ribbonSegments,
  sessionLengthForWindow,
  startOfLocalDay,
  WEEKDAYS,
  type Slot,
} from "@/lib/timeline";
import { enqueue } from "@/lib/offline-queue";
import { useNow } from "@/lib/use-now";
import { useFocusState } from "@/lib/focus-timer";
import { MondayReview } from "@/components/tempo/WeeklyReview";
import { Card, EnergyPicker } from "@/components/tempo/bits";
import { ConnectGoogleButton } from "@/components/tempo/ConnectGoogle";
import { DayRibbonLive } from "@/components/tempo/DayRibbon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { morningEnergyTitle } from "@/lib/fix-rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { title: "Today · Tempo" },
      { name: "description", content: "Your day, focus windows and meetings." },
      { property: "og:title", content: "Today · Tempo" },
      { property: "og:description", content: "Your day, focus windows and meetings." },
    ],
  }),
  component: Today,
});

const MAX_BACK = 7;
const REASONS: { id: StressReason; label: string }[] = [
  { id: "high_stakes", label: "High stakes" },
  { id: "conflict", label: "Conflict" },
  { id: "presenting", label: "Presenting" },
  { id: "other", label: "Other" },
];

const itemDomId = (id: string) => `tl-${id}`;
function scrollToItem(id: string) {
  const el = document.getElementById(itemDomId(id));
  if (!el) return;
  el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  const focusable = el.querySelector<HTMLElement>("button, a");
  focusable?.focus({ preventScroll: true });
}

function Today() {
  const { data: settings } = useSettings();
  const [offset, setOffset] = useState(0);
  const now = useNow(30_000);
  const focusRunning = !!useFocusState();
  const day = useMemo(() => {
    const d = startOfLocalDay(new Date(now));
    d.setDate(d.getDate() + offset);
    return d;
  }, [offset, now]);
  const isToday = offset === 0;
  const isPast = offset < 0;
  const dayKey = localDateKey(day);
  const keywords = settings?.keywords ?? [];
  const { events, status, isLoading, offline } = useDayEvents(day, keywords);
  const logs = useDayLogs(day);
  const dismissals = useCheckinDismissals(day);
  const listCals = useServerFn(getCalendarList);
  const cals = useQuery({ queryKey: ["calendars"], queryFn: () => listCals(), staleTime: 10 * 60_000, enabled: (settings?.calendar_ids.length ?? 0) > 1 });
  const calColours = new Map((cals.data?.calendars ?? []).filter((c) => c.color).map((c) => [c.id, c.color!]));

  if (!settings || isLoading) return <TodaySkeleton />;

  const work = workWindow(settings, day);
  const workStart = work.start;
  const workEnd = work.end;
  const dayOff = !work.on;
  const multiCal = settings.calendar_ids.length > 1;
  const timed = events
    .filter((e) => !e.allDay)
    .map((e) => (multiCal && e.calendarId && calColours.get(e.calendarId) ? { ...e, color: calColours.get(e.calendarId)! } : e));
  const allDay = events.filter((e) => e.allDay);
  const nowDate = new Date(now);
  const slots = computeSlots(timed, workStart, workEnd, settings.min_focus_min, isToday ? nowDate : undefined, settings.meeting_buffer_min);
  const windows = slots.filter((s) => s.isWindow);
  const best = slots.find((s) => s.best) ?? null;
  const dayEnd = new Date(startOfLocalDay(day));
  dayEnd.setDate(dayEnd.getDate() + 1);
  // On a day off meetings still count across the whole day.
  const meetMin = dayOff ? meetingMinutes(timed, startOfLocalDay(day), dayEnd) : meetingMinutes(timed, workStart, workEnd);
  const focusMin = (logs.data?.sessions ?? []).reduce((a, s) => a + (s.actual_min ?? 0), 0);
  const morning = logs.data?.ratings.find((r) => r.kind === "morning");
  const nextEvent = timed.find((e) => new Date(e.start).getTime() > now && e.kind === "meeting");
  const primedIds = new Set((logs.data?.primes ?? []).map((p) => p.event_id));
  const ratedIds = new Set((logs.data?.ratings ?? []).filter((r) => r.kind === "after_meeting").map((r) => r.event_id));
  const dismissed = dismissals.data ?? new Set<string>();

  const primeDue = isToday
    ? timed.filter((e) => {
        const s = new Date(e.start).getTime();
        return e.stressful && !primedIds.has(e.id) && now >= s - settings.prime_lead_min * 60_000 && now < s;
      })
    : [];
  const checkinsDue = isToday
    ? timed
        .filter((e) => e.stressful && new Date(e.end).getTime() <= now && !ratedIds.has(e.id) && !dismissed.has(e.id))
        .sort((a, b) => b.end.localeCompare(a.end))
    : [];
  const currentWindow = isToday ? windows.find((s) => s.start.getTime() <= now && s.end.getTime() > now) ?? null : null;

  // Ribbon: today/future show focus windows from the whole working day (not clipped to now).
  const ribbonSlots = computeSlots(timed, workStart, workEnd, settings.min_focus_min, undefined, settings.meeting_buffer_min);
  const titleById = new Map(timed.map((e) => [e.id, e.title]));
  const segments = ribbonSegments(timed, ribbonSlots, workStart, workEnd).map((s) => ({
    ...s,
    title: titleById.get(s.id) ?? `${fmtDuration((s.w * (workEnd.getTime() - workStart.getTime())) / 60000)} clear`,
  }));
  const onSegment = (id: string) => {
    if (id.startsWith("slot:")) {
      // Map a full-day ribbon window to the matching (possibly now-clipped) timeline slot.
      const t = Number(id.slice(5));
      const ribbonSlot = ribbonSlots.find((s) => s.start.getTime() === t);
      const match = ribbonSlot && slots.find((s) => s.end.getTime() === ribbonSlot.end.getTime());
      scrollToItem(match ? `slot:${match.start.getTime()}` : id);
    } else scrollToItem(id);
  };

  const headline = (() => {
    if (!isToday) return day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const first = slots.find((s) => s.isWindow && s.start.getTime() <= now + 60_000);
    if (first) return `Clear run until ${fmtTime(first.end)}.`;
    if (nextEvent) return `Next up at ${fmtTime(nextEvent.start)}.`;
    return "Nothing else today.";
  })();

  const dayLabel = isToday
    ? "Today"
    : offset === 1
      ? "Tomorrow"
      : offset === -1
        ? "Yesterday"
        : day.toLocaleDateString("en-GB", { weekday: "long" });

  // Floating action: prime > rate > start focus.
  const fab = (() => {
    if (!isToday || focusRunning) return null;
    const p = primeDue[0];
    if (p) return { kind: "prime" as const, label: "Prime now", e: p };
    if (checkinsDue.length) return { kind: "rate" as const, label: "Rate the meeting" };
    if (currentWindow) return { kind: "focus" as const, label: `Start focus · until ${fmtTime(currentWindow.end)}`, slot: currentWindow };
    return { kind: "reset" as const, label: "60-second reset" };
  })();

  const target = settings.daily_focus_target_min;

  return (
    <div className={cn("space-y-4", fab && "pb-20")}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-accent-text">{dayLabel}</p>
          <h1 className="text-2xl font-semibold leading-tight">{headline}</h1>
        </div>
        <Button asChild variant="ghost" size="icon" aria-label="Settings">
          <Link to="/settings"><Gear /></Link>
        </Button>
      </header>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="Previous day" disabled={offset <= -MAX_BACK} onClick={() => setOffset((o) => o - 1)}>
          <ChevronLeft />
        </Button>
        <span className="text-sm text-muted-foreground">
          {day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          {isPast ? " · Past day · read-only" : !isToday ? " · planning view" : ""}
        </span>
        <Button variant="ghost" size="icon" aria-label="Next day" disabled={offset >= 6} onClick={() => setOffset((o) => o + 1)}>
          <ChevronRight />
        </Button>
      </div>

      {dayOff ? (
        <Card className="flex items-center justify-between gap-3">
          <p className="text-sm"><span className="font-semibold">Day off</span> · no work hours set</p>
          {!isPast && (
            <Button asChild size="sm" variant="outline">
              <Link to="/focus"><Play /> Start focus</Link>
            </Button>
          )}
        </Card>
      ) : (
        <DayRibbonLive
          segments={segments}
          nowFrac={isToday ? nowFraction(nowDate, workStart, workEnd) : null}
          startLabel={fmtTime(workStart)}
          endLabel={fmtTime(workEnd)}
          onSegment={onSegment}
        />
      )}

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

      {isToday && day.getDay() === 1 && <MondayReview />}
      {isToday && !morning && <MorningCheck dayKey={dayKey} />}

      {isToday && <PrimeCards due={primeDue} leadMin={settings.prime_lead_min} now={now} />}
      {isToday && <BackToBack events={timed} workStart={workStart} workEnd={workEnd} now={nowDate} dayKey={dayKey} />}
      {isToday && <CheckIns due={checkinsDue} primed={primedIds} intents={primeIntents(logs.data?.primes ?? [])} dayKey={dayKey} />}

      {isToday && best && <BestWindow slot={best} now={nowDate} />}

      <div className="grid grid-cols-3 gap-2 text-center">
        <Glance label="Meetings" value={fmtDuration(meetMin)} />
        <Glance label="Focus so far" value={fmtDuration(focusMin)} />
        <Glance label="Windows left" value={String(windows.length)} />
      </div>
      {!(offset > 0) && (
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label="Daily focus target" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(focusMin, target)}>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(100, (focusMin / target) * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground tabular">{fmtDuration(focusMin)} of {fmtDuration(target)}</p>
        </div>
      )}

      {allDay.length > 0 && (
        <ul className="space-y-1">
          {allDay.map((e) => (
            <li key={e.id} className="rounded-xl border border-subtle px-3 py-2 text-sm text-muted-foreground">
              All day · <span className="text-foreground">{e.title}</span>
            </li>
          ))}
        </ul>
      )}

      <Timeline events={timed} slots={slots} isToday={isToday} readOnly={isPast} now={now} day={day} />

      {isPast && <PastLogs logs={logs.data} />}
      {!isPast && <AddBlock day={day} />}

      {fab && (
        <div className="pointer-events-none fixed inset-x-0 z-30 mx-auto max-w-lg px-4" style={{ bottom: "calc(4rem + env(safe-area-inset-bottom) + 0.75rem)" }}>
          {fab.kind === "prime" ? (
            <Button asChild size="lg" className="pointer-events-auto w-full shadow-glow">
              <Link to="/prime" search={{ event: fab.e.id, at: fab.e.start }}><Wind /> {fab.label}</Link>
            </Button>
          ) : fab.kind === "reset" ? (
            <Button asChild size="lg" variant="outline" className="pointer-events-auto w-full bg-card">
              <Link to="/prime" search={{ quick: 1 }}><Wind /> {fab.label}</Link>
            </Button>
          ) : fab.kind === "rate" ? (
            <Button size="lg" className="pointer-events-auto w-full shadow-glow" onClick={() => document.getElementById("checkins")?.scrollIntoView({ block: "center" })}>
              <Zap /> {fab.label}
            </Button>
          ) : (
            <FocusFab slot={fab.slot} now={nowDate} label={fab.label} />
          )}
        </div>
      )}
    </div>
  );
}

function FocusFab({ slot, now, label }: { slot: Slot; now: Date; label: string }) {
  const navigate = useNavigate();
  return (
    <Button
      size="lg"
      className="pointer-events-auto w-full shadow-glow"
      onClick={() => navigate({ to: "/focus", search: { minutes: sessionLengthForWindow(slot, now), until: slot.end.toISOString() } })}
    >
      <Play /> {label}
    </Button>
  );
}

function TodaySkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div className="h-5 w-16 animate-pulse rounded bg-secondary" />
      <div className="h-8 w-56 animate-pulse rounded bg-secondary" />
      <div className="h-8 animate-pulse rounded-full bg-secondary" />
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

function BestWindow({ slot, now }: { slot: Slot; now: Date }) {
  const navigate = useNavigate();
  const mins = sessionLengthForWindow(slot, now);
  return (
    <section aria-label="Best window" className="rounded-3xl border border-primary bg-accent p-5 shadow-glow">
      <span className="inline-block rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-gold-foreground">Best window</span>
      <p className="mt-3 font-display text-3xl font-semibold tabular">{fmtDuration(slot.minutes)}</p>
      <p className="text-muted-foreground tabular">{fmtTime(slot.start)}–{fmtTime(slot.end)}</p>
      <Button
        size="lg"
        className="mt-4 w-full"
        onClick={() => navigate({ to: "/focus", search: { minutes: mins, until: slot.end.toISOString() } })}
      >
        Start {mins} min focus
      </Button>
    </section>
  );
}

function MorningCheck({ dayKey }: { dayKey: string }) {
  const qc = useQueryClient();
  const now = useNow(60_000);
  return (
    <Card className="space-y-3">
      <p className="font-semibold">{morningEnergyTitle(new Date(now))}</p>
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

function PrimeCards({ due, leadMin, now }: { due: DayEvent[]; leadMin: number; now: number }) {
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

function BackToBack({ events, workStart, workEnd, now, dayKey }: { events: DayEvent[]; workStart: Date; workEnd: Date; now: Date; dayKey: string }) {
  const storeKey = `tempo.b2b.${dayKey}`;
  const [dismissed, setDismissed] = useState<string | null>(() => (typeof window === "undefined" ? null : localStorage.getItem(storeKey)));
  const run = backToBackRun(events, workStart, workEnd, now);
  if (!run) return null;
  const runId = String(run.start.getTime());
  const soon = now.getTime() >= run.start.getTime() - 60 * 60_000;
  if (!soon || dismissed === runId) return null;
  return (
    <Card className="space-y-3">
      <p className="font-semibold">No break until {fmtTime(run.end)}. Two minutes now?</p>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild>
          <Link to="/prime" search={{ quick: 1 }}><Wind /> Quick prime</Link>
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            localStorage.setItem(storeKey, runId);
            setDismissed(runId);
          }}
        >
          Dismiss
        </Button>
      </div>
    </Card>
  );
}

function CheckIns({ due, primed, intents, dayKey }: { due: DayEvent[]; primed: Set<string | null>; intents: Map<string, string>; dayKey: string }) {
  const [outcome, setOutcome] = useState<Record<string, IntentOutcome>>({});
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const dismiss = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("checkin_dismissals").upsert({ event_id: eventId, local_date: dayKey }, { onConflict: "user_id,event_id,local_date", ignoreDuplicates: true });
      if (error) throw error;
    },
    onMutate: async (eventId) => {
      const key = ["checkin_dismissals", dayKey];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Set<string>>(key);
      qc.setQueryData(key, new Set([...(prev ?? []), eventId]));
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      qc.setQueryData(["checkin_dismissals", dayKey], ctx?.prev);
      toast.error("Couldn't dismiss that. Try again.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["checkin_dismissals", dayKey] }),
  });
  if (!due.length) return null;
  const expanded = open ?? due[0]!.id;
  return (
    <section id="checkins" aria-label="After-meeting check-ins" className="space-y-2">
      {due.map((e) => {
        const isOpen = e.id === expanded;
        return (
          <Card key={e.id} className={cn("space-y-3", !isOpen && "py-3")}>
            <div className="flex items-center justify-between gap-2">
              <button className="min-w-0 flex-1 text-left" aria-expanded={isOpen} onClick={() => setOpen(e.id)}>
                <p className="font-semibold">How did that land?</p>
                <p className="truncate text-sm text-muted-foreground">{e.title} · {fmtTime(e.end)}</p>
              </button>
              <button onClick={() => dismiss.mutate(e.id)} className="tap text-sm text-muted-foreground underline" aria-label={`Dismiss check-in for ${e.title}`}>
                Dismiss
              </button>
            </div>
            {isOpen && (
              <>
                {intents.get(e.id) && (
                  <div className="space-y-2">
                    <p className="break-words text-sm">You wanted: <span className="font-semibold">{intents.get(e.id)}</span></p>
                    <p className="text-sm text-muted-foreground">Did you get it?</p>
                    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Did you get it?">
                      {INTENT_OUTCOMES.map((o) => (
                        <Button key={o.value} variant="outline" role="radio" aria-checked={outcome[e.id] === o.value}
                          className={cn(outcome[e.id] === o.value ? "border-primary bg-accent" : "border-border bg-card")}
                          onClick={() => setOutcome({ ...outcome, [e.id]: o.value })}>{o.label}</Button>
                      ))}
                    </div>
                  </div>
                )}
                <Input aria-label="Optional note" placeholder="One line, if you like" maxLength={200} className="h-12" value={note[e.id] ?? ""} onChange={(x) => setNote({ ...note, [e.id]: x.target.value })} />
                <EnergyPicker
                  label="Energy after the meeting"
                  value={null}
                  onChange={(v) => {
                    enqueue("energy_ratings", afterMeetingRating({
                      id: crypto.randomUUID(), rating: v, note: note[e.id], eventId: e.id,
                      primed: primed.has(e.id), intention: intents.get(e.id) ?? null,
                      outcome: outcome[e.id] ?? null, dayKey, at: new Date().toISOString(),
                    }));
                    setOpen(null);
                    qc.invalidateQueries({ queryKey: ["daylogs", dayKey] });
                  }}
                />
              </>
            )}
          </Card>
        );
      })}
    </section>
  );
}

function Timeline({ events, slots, isToday, readOnly, now, day }: { events: DayEvent[]; slots: Slot[]; isToday: boolean; readOnly: boolean; now: number; day: Date }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dayKey = localDateKey(day);
  const [stressFor, setStressFor] = useState<DayEvent | null>(null);
  const [editBlock, setEditBlock] = useState<DayEvent | null>(null);
  const press = useRef<{ t: number | null; fired: boolean }>({ t: null, fired: false });

  const toggle = useMutation({
    mutationFn: async (e: DayEvent) => {
      const { error } = await supabase
        .from("event_flags")
        .upsert({ event_id: e.id, stressful: !e.stressful, reason: e.stressful ? null : e.reason, start_at: e.start, end_at: e.end }, { onConflict: "user_id,event_id" });
      if (error) throw error;
    },
    onError: () => toast.error("Couldn't update that meeting. Try again."),
    onSettled: () => qc.invalidateQueries({ queryKey: ["event_flags", dayKey] }),
  });

  type Item = { t: number; end: number; kind: "slot"; slot: Slot } | { t: number; end: number; kind: "event"; e: DayEvent };
  const items: Item[] = [
    ...slots.filter((s) => s.minutes >= 5).map((slot) => ({ t: slot.start.getTime(), end: slot.end.getTime(), kind: "slot" as const, slot })),
    ...events.map((e) => ({ t: new Date(e.start).getTime(), end: new Date(e.end).getTime(), kind: "event" as const, e })),
  ].sort((a, b) => a.t - b.t);

  if (!items.length) return <p className="text-muted-foreground">{isToday ? "No working hours left today." : "Nothing on this day."}</p>;

  const nowIndex = isToday ? items.findIndex((it) => it.t >= now) : -1;
  const nowLine = (
    <li key="now" aria-label={`Now, ${fmtTime(new Date(now))}`} className="relative -ml-4 flex items-center gap-2 py-1">
      <span className="h-3 w-3 -translate-x-[7px] rounded-full bg-primary" aria-hidden />
      <span className="text-xs font-semibold text-accent-text tabular">Now · {fmtTime(new Date(now))}</span>
      <span className="h-px flex-1 bg-primary" aria-hidden />
    </li>
  );

  const startPress = (e: DayEvent) => {
    press.current.fired = false;
    press.current.t = window.setTimeout(() => {
      press.current.fired = true;
      setStressFor(e);
    }, 550);
  };
  const endPress = () => {
    if (press.current.t) window.clearTimeout(press.current.t);
    press.current.t = null;
  };

  const rendered: React.ReactNode[] = [];
  items.forEach((it, i) => {
    if (i === nowIndex) rendered.push(nowLine);
    const past = isToday && it.end <= now;
    if (it.kind === "slot") {
      const id = `slot:${it.t}`;
      rendered.push(
        <li key={id} id={itemDomId(id)} className={cn(past && "opacity-50")}>
          {it.slot.isWindow && isToday ? (
            <button
              onClick={() => navigate({ to: "/focus", search: { minutes: sessionLengthForWindow(it.slot, new Date(now)), until: it.slot.end.toISOString() } })}
              className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">Clear run · {fmtDuration(it.slot.minutes)}</span>
                {it.slot.best && <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-gold-foreground">Best</span>}
              </div>
              <span className="text-sm text-muted-foreground tabular">{fmtTime(it.slot.start)}–{fmtTime(it.slot.end)} · tap to focus</span>
            </button>
          ) : it.slot.isWindow ? (
            <div className="rounded-2xl border border-border bg-card p-4">
              <span className="font-semibold">Clear run · {fmtDuration(it.slot.minutes)}</span>
              <div className="text-sm text-muted-foreground tabular">{fmtTime(it.slot.start)}–{fmtTime(it.slot.end)}</div>
            </div>
          ) : (
            <p className="py-1 text-sm text-muted-foreground tabular">{fmtTime(it.slot.start)} · {fmtDuration(it.slot.minutes)} gap</p>
          )}
        </li>,
      );
      return;
    }
    const e = it.e;
    const isManual = e.source === "manual";
    const isMeeting = e.kind === "meeting";
    const onTap = () => {
      if (press.current.fired) return;
      if (readOnly) return;
      if (isManual) setEditBlock(e);
      else if (isMeeting) toggle.mutate(e);
    };
    rendered.push(
      <li key={e.id} id={itemDomId(e.id)} className={cn(past && "opacity-50")}>
        <div
          className={cn(
            "flex items-center gap-2 overflow-hidden rounded-2xl border border-l-4 p-3",
            e.kind === "focus" ? "border-primary border-l-primary bg-card" : "bg-secondary",
            isMeeting && (e.stressful ? "border-gold-text border-l-gold" : "border-subtle border-l-muted-foreground"),
          )}
          style={isMeeting && !e.stressful && e.color ? { borderLeftColor: e.color } : undefined}
        >
          <button
            className="min-w-0 flex-1 text-left disabled:cursor-default"
            disabled={readOnly || (!isMeeting && !isManual)}
            onClick={onTap}
            onPointerDown={() => isMeeting && !readOnly && startPress(e)}
            onPointerUp={endPress}
            onPointerLeave={endPress}
            onContextMenu={(x) => isMeeting && x.preventDefault()}
            aria-label={
              readOnly
                ? undefined
                : isManual
                  ? `${e.title}. Tap to edit.`
                  : isMeeting
                    ? `${e.title}. ${e.stressful ? "Marked stressful. Tap to unmark." : "Tap to mark stressful."}`
                    : undefined
            }
          >
            <div className="flex items-center gap-2 font-semibold">
              {e.stressful && <Zap className="h-4 w-4 shrink-0 text-gold-text" aria-hidden />}
              {e.recurringId && <Repeat className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Repeats" />}
              <span className="truncate">{e.title}</span>
            </div>
            <div className="text-sm text-muted-foreground tabular">
              {fmtTime(e.start)}–{fmtTime(e.end)} · {fmtMinutesShort(e.start, e.end)}
              {e.stressful && (e.reason ? ` · ${REASONS.find((r) => r.id === e.reason)?.label}` : " · stressful")}
            </div>
          </button>
          {isMeeting && !readOnly && (
            <Button variant="ghost" size="icon" aria-label={`More options for ${e.title}`} onClick={() => setStressFor(e)}>
              <MoreHorizontal />
            </Button>
          )}
        </div>
      </li>,
    );
  });
  if (isToday && nowIndex === -1) rendered.push(nowLine);

  return (
    <>
      <ol className="relative space-y-2 border-l-2 border-subtle pl-4" aria-label="Timeline">{rendered}</ol>
      {stressFor && <StressSheet event={stressFor} dayKey={dayKey} onClose={() => setStressFor(null)} />}
      {editBlock && <BlockSheet day={day} existing={editBlock} onClose={() => setEditBlock(null)} />}
    </>
  );
}

function StressSheet({ event, dayKey, onClose }: { event: DayEvent; dayKey: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [stressful, setStressful] = useState(event.stressful);
  const [reason, setReason] = useState<StressReason | null>(event.reason);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("event_flags")
        .upsert({ event_id: event.id, stressful, reason: stressful ? reason : null, start_at: event.start, end_at: event.end }, { onConflict: "user_id,event_id" });
      if (error) throw error;
    },
    onSuccess: onClose,
    onError: () => toast.error("Couldn't update that meeting. Try again."),
    onSettled: () => qc.invalidateQueries({ queryKey: ["event_flags", dayKey] }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{event.title}</DialogTitle>
          <DialogDescription>{fmtTime(event.start)}–{fmtTime(event.end)}</DialogDescription>
        </DialogHeader>
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span className="font-medium">Stressful meeting</span>
          <Switch checked={stressful} onCheckedChange={setStressful} />
        </label>
        {stressful && (
          <div className="space-y-2">
            <p className="text-sm font-semibold" id="reason-label">Why? (optional)</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="reason-label">
              {REASONS.map((r) => (
                <Button key={r.id} size="sm" role="radio" aria-checked={reason === r.id} variant={reason === r.id ? "default" : "outline"} onClick={() => setReason(reason === r.id ? null : r.id)}>
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button size="lg" className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RepeatMode = "none" | "weekdays" | "daily" | "custom";
const DAY_CHIPS = [
  { d: 1, l: "Mon" },
  { d: 2, l: "Tue" },
  { d: 3, l: "Wed" },
  { d: 4, l: "Thu" },
  { d: 5, l: "Fri" },
  { d: 6, l: "Sat" },
  { d: 0, l: "Sun" },
];
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function AddBlock({ day }: { day: Date }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus /> Add a block
      </Button>
      {open && <BlockSheet day={day} existing={null} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Add or edit a manual block, optionally repeating. */
function BlockSheet({ day, existing, onClose }: { day: Date; existing: DayEvent | null; onClose: () => void }) {
  const qc = useQueryClient();
  const dayKey = localDateKey(day);
  const isRecurring = !!existing?.recurringId;
  const [kind, setKind] = useState<"meeting" | "focus">(existing?.kind === "focus" ? "focus" : "meeting");
  const [start, setStart] = useState(existing ? hhmm(existing.start) : "10:00");
  const [end, setEnd] = useState(existing ? hhmm(existing.end) : "11:00");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [repeat, setRepeat] = useState<RepeatMode>("none");
  const [days, setDays] = useState<number[]>([day.getDay()]);
  const [scope, setScope] = useState<"day" | "all">("day");

  const repeatDays = repeat === "weekdays" ? WEEKDAYS : repeat === "daily" ? EVERY_DAY : repeat === "custom" ? days : [];
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["manual_blocks"] });
    qc.invalidateQueries({ queryKey: ["recurring_blocks"] });
    qc.invalidateQueries({ queryKey: ["recurring_skips"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (end <= start) throw new Error("order");
      const clean = label.trim().slice(0, 40) || null;
      const oneOff = { kind, label: clean, start_at: atLocal(day, start).toISOString(), end_at: atLocal(day, end).toISOString() };
      if (isRecurring && existing) {
        if (scope === "all") {
          const { error } = await supabase.from("recurring_blocks").update({ kind, label: clean, start_time: start, end_time: end }).eq("id", existing.recurringId!);
          if (error) throw error;
        } else {
          const { error: e1 } = await supabase.from("recurring_skips").upsert({ block_id: existing.recurringId!, local_date: dayKey }, { onConflict: "user_id,block_id,local_date", ignoreDuplicates: true });
          if (e1) throw e1;
          const { error: e2 } = await supabase.from("manual_blocks").insert(oneOff);
          if (e2) throw e2;
        }
        return;
      }
      if (repeat !== "none") {
        if (!repeatDays.length) throw new Error("days");
        const { error } = await supabase.from("recurring_blocks").insert({ kind, label: clean, start_time: start, end_time: end, days: repeatDays });
        if (error) throw error;
        if (existing?.manualId) {
          const { error: d } = await supabase.from("manual_blocks").delete().eq("id", existing.manualId);
          if (d) throw d;
        }
        return;
      }
      if (existing?.manualId) {
        const { error } = await supabase.from("manual_blocks").update(oneOff).eq("id", existing.manualId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("manual_blocks").insert(oneOff);
        if (error) throw error;
      }
    },
    onSuccess: onClose,
    onError: (e) => toast.error(e.message === "order" ? "End needs to be after start." : e.message === "days" ? "Pick at least one day." : "Couldn't save that block."),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!existing) return;
      if (isRecurring) {
        if (scope === "all") {
          const { error } = await supabase.from("recurring_blocks").delete().eq("id", existing.recurringId!);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("recurring_skips").upsert({ block_id: existing.recurringId!, local_date: dayKey }, { onConflict: "user_id,block_id,local_date", ignoreDuplicates: true });
          if (error) throw error;
        }
        return;
      }
      const { error } = await supabase.from("manual_blocks").delete().eq("id", existing.manualId!);
      if (error) throw error;
    },
    onSuccess: onClose,
    onError: () => toast.error("Couldn't remove that block."),
    onSettled: refresh,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit block" : "Add a block"}</DialogTitle>
        </DialogHeader>
        {isRecurring && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Apply to">
            <Button role="radio" aria-checked={scope === "day"} variant={scope === "day" ? "default" : "outline"} onClick={() => setScope("day")}>This day only</Button>
            <Button role="radio" aria-checked={scope === "all"} variant={scope === "all" ? "default" : "outline"} onClick={() => setScope("all")}>All days</Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Block type">
          {(["meeting", "focus"] as const).map((k) => (
            <Button key={k} role="radio" aria-checked={kind === k} variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>
              {k === "meeting" ? "Meeting" : "Focus"}
            </Button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bl">Label (optional)</Label>
          <Input id="bl" maxLength={40} className="h-12" placeholder="e.g. Gym, School run" value={label} onChange={(e) => setLabel(e.target.value)} />
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
        {!isRecurring && (
          <div className="space-y-2">
            <p className="text-sm font-semibold" id="rep-label">Repeat</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="rep-label">
              {([["none", "None"], ["weekdays", "Weekdays"], ["daily", "Every day"], ["custom", "Custom days"]] as const).map(([m, l]) => (
                <Button key={m} size="sm" role="radio" aria-checked={repeat === m} variant={repeat === m ? "default" : "outline"} onClick={() => setRepeat(m)}>
                  {l}
                </Button>
              ))}
            </div>
            {repeat === "custom" && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days">
                {DAY_CHIPS.map(({ d, l }) => (
                  <Button key={d} size="sm" aria-pressed={days.includes(d)} variant={days.includes(d) ? "default" : "outline"} onClick={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}>
                    {l}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          {existing && (
            <Button variant="ghost" className="text-destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
              Delete
            </Button>
          )}
          <Button size="lg" disabled={save.isPending} onClick={() => save.mutate()}>{existing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Logs = ReturnType<typeof useDayLogs>["data"];
function PastLogs({ logs }: { logs: Logs }) {
  if (!logs) return null;
  const rows = [
    ...logs.sessions.map((s) => ({ id: s.id, at: s.started_at, text: `Focus · ${s.actual_min} min${s.intention ? ` · ${s.intention}` : ""}` })),
    ...logs.primes.map((p) => ({ id: p.id, at: p.at, text: `Prime · ${Math.max(1, Math.round((p.duration_s ?? 0) / 60))} min` })),
    ...logs.ratings.map((r) => ({ id: r.id, at: r.at, text: `${r.kind === "morning" ? "Morning energy" : "After meeting"} · ${r.rating}` })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <section aria-labelledby="past-logs" className="space-y-2">
      <h2 id="past-logs" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Logged that day</h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Nothing logged.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-subtle bg-card p-3 text-sm">
              <span className="tabular text-muted-foreground">{fmtTime(r.at)}</span> · {r.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
