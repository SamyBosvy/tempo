import { createFileRoute } from "@tanstack/react-router";
import { localDateFromKey } from "@/lib/fix-rules";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getCalendarEvents } from "@/lib/google.functions";
import { meetingMinutes, localDateKey, startOfLocalDay, atLocal, type CalEvent } from "@/lib/timeline";
import { useSettings } from "@/lib/settings";
import { Card, PageTitle, ScreenSkeleton } from "@/components/tempo/bits";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights · Tempo" },
      { name: "description", content: "When you actually work best." },
      { property: "og:title", content: "Insights · Tempo" },
      { property: "og:description", content: "When you actually work best." },
    ],
  }),
  component: Insights,
});

type InsightData = {
  session_count: number;
  rating_count: number;
  by_hour: { hour: number; minutes: number; avg_energy: number | null; count: number }[];
  by_day: { day: string; minutes: number }[];
  by_week: { week: string; minutes: number }[];
  energy_by_hour: { hour: number; avg: number }[];
  primed: { primed_n: number; primed_avg: number | null; unprimed_n: number; unprimed_avg: number | null };
  interruptions: { reason: string; count: number }[];
};

const REASON: Record<string, string> = { meeting: "Meeting ran over", message: "Message/phone", distracted: "Distracted", other: "Other" };
const axis = { stroke: "var(--color-muted-foreground)", fontSize: 12 };

function Insights() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const q = useQuery({
    queryKey: ["insights", tz],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_insights", { _tz: tz });
      if (error) throw error;
      return data as unknown as InsightData;
    },
  });
  if (q.isLoading) return <ScreenSkeleton rows={4} />;
  if (q.isError || !q.data) return <p role="alert">Couldn't load insights. Try again.</p>;
  const d = q.data;
  if (d.session_count < 5 && d.rating_count < 5)
    return (
      <div>
        <PageTitle>Insights</PageTitle>
        <Card><p>Keep going. Patterns show after 5 sessions.</p></Card>
      </div>
    );

  const maxMin = Math.max(1, ...d.by_hour.map((h) => h.minutes));
  return (
    <div className="space-y-4">
      <PageTitle>Insights</PageTitle>

      <Card>
        <h2 className="mb-3 font-semibold">Best hours for focus</h2>
        {d.by_hour.length === 0 ? <Empty /> : (
          <div className="grid grid-cols-6 gap-1.5" role="list">
            {Array.from({ length: 24 }, (_, h) => h).filter((h) => h >= 6 && h <= 23).map((h) => {
              const row = d.by_hour.find((x) => x.hour === h);
              const intensity = row ? 0.15 + 0.85 * (row.minutes / maxMin) : 0;
              return (
                <div role="listitem" key={h} className="relative flex h-14 flex-col items-center justify-center rounded-lg border border-subtle text-xs"
                  aria-label={`${h}:00, ${row?.minutes ?? 0} minutes${row?.avg_energy ? `, energy ${row.avg_energy}` : ""}`}>
                  <div aria-hidden className="absolute inset-0 rounded-lg bg-primary" style={{ opacity: intensity }} />
                  <span className="relative font-semibold tabular">{String(h).padStart(2, "0")}</span>
                  <span className="relative tabular text-[11px]">{row?.avg_energy ?? "–"}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Shade = minutes focused. Number = average energy after.</p>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Focus minutes per day</h2>
        {d.by_day.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={d.by_day.map((x) => ({ ...x, label: localDateFromKey(String(x.day)).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) }))}>
              <CartesianGrid stroke="var(--color-subtle)" vertical={false} />
              <XAxis dataKey="label" tick={axis} interval="preserveStartEnd" />
              <YAxis tick={axis} width={32} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              <Bar dataKey="minutes" name="Focus min" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Focus minutes per week</h2>
        {d.by_week.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={d.by_week.map((x) => ({ ...x, label: localDateFromKey(String(x.week)).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) }))}>
              <XAxis dataKey="label" tick={axis} />
              <YAxis tick={axis} width={32} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              <Bar dataKey="minutes" name="Focus min" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <MeetingsVsFocus byDay={d.by_day} />

      <Card>
        <h2 className="mb-3 font-semibold">Energy across the day</h2>
        {d.energy_by_hour.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={d.energy_by_hour.map((x) => ({ ...x, label: `${String(x.hour).padStart(2, "0")}:00` }))}>
              <CartesianGrid stroke="var(--color-subtle)" vertical={false} />
              <XAxis dataKey="label" tick={axis} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={axis} width={24} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              <Line type="monotone" dataKey="avg" name="Energy" stroke="var(--color-chart-2)" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {d.primed.primed_n >= 3 && d.primed.unprimed_n >= 3 && (
        <Card>
          <h2 className="mb-2 font-semibold">Primed vs not primed</h2>
          <p className="text-sm text-muted-foreground">Average energy after stressful meetings.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-secondary p-3"><div className="text-2xl font-semibold text-gold-text tabular">{d.primed.primed_avg}</div><div className="text-xs">Primed ({d.primed.primed_n})</div></div>
            <div className="rounded-xl bg-secondary p-3"><div className="text-2xl font-semibold tabular">{d.primed.unprimed_avg}</div><div className="text-xs">Not primed ({d.primed.unprimed_n})</div></div>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 font-semibold">Interruptions</h2>
        {d.interruptions.length === 0 ? <p className="text-sm text-muted-foreground">None logged.</p> : (
          <ul className="space-y-2">
            {d.interruptions.sort((a, b) => b.count - a.count).map((i) => (
              <li key={i.reason} className="flex justify-between"><span>{REASON[i.reason] ?? i.reason}</span><span className="tabular font-semibold">{i.count}</span></li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">Nothing here yet.</p>;
}

function MeetingsVsFocus({ byDay }: { byDay: { day: string; minutes: number }[] }) {
  const { data: settings } = useSettings();
  const fetchEvents = useServerFn(getCalendarEvents);
  const q = useQuery({
    queryKey: ["gcal-week"],
    enabled: !!settings,
    queryFn: async () => {
      const end = startOfLocalDay(new Date());
      end.setDate(end.getDate() + 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      const res = await fetchEvents({ data: { timeMin: start.toISOString(), timeMax: end.toISOString() } });
      const events = res.events as unknown as CalEvent[];
      return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(start);
        day.setDate(day.getDate() + i);
        const key = localDateKey(day);
        const mm = meetingMinutes(events.map((e) => ({ ...e, source: "google" as const })), atLocal(day, settings!.work_start), atLocal(day, settings!.work_end));
        return {
          label: day.toLocaleDateString("en-GB", { weekday: "short" }),
          meetings: Math.round((mm / 60) * 10) / 10,
          focus: Math.round(((byDay.find((b) => b.day === key)?.minutes ?? 0) / 60) * 10) / 10,
        };
      });
    },
  });
  return (
    <Card>
      <h2 className="mb-3 font-semibold">Meetings vs focus (hours, last 7 days)</h2>
      {q.isLoading ? <div role="status" aria-busy="true" className="h-44 animate-pulse rounded-xl bg-secondary"><span className="sr-only">Loading</span></div>
        : q.isError ? <p className="text-sm text-muted-foreground">Calendar unavailable right now.</p> : (
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={q.data ?? []}>
            <XAxis dataKey="label" tick={axis} />
            <YAxis tick={axis} width={28} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
            <Bar dataKey="meetings" name="Meetings" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="focus" name="Focus" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
