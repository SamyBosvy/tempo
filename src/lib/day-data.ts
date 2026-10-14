// Per-screen queries for one local day. Event titles live only in memory /
// device storage; the database only stores ids, times and flags.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCalendarEvents, type EventsResult } from "./google.functions";
import { localDateKey, matchesKeywords, startOfLocalDay, type CalEvent } from "./timeline";
import { pendingRows } from "./offline-queue";

export type DayEvent = CalEvent & { stressful: boolean; flagged: boolean | null };

function dayRange(day: Date) {
  const from = startOfLocalDay(day);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

const cacheKey = (k: string) => `tempo.day.${k}`;

export function useGoogleDay(day: Date) {
  const fetchEvents = useServerFn(getCalendarEvents);
  const key = localDateKey(day);
  return useQuery({
    queryKey: ["gcal", key],
    queryFn: async (): Promise<EventsResult & { offline?: boolean }> => {
      const { from, to } = dayRange(day);
      try {
        const res = await fetchEvents({ data: { timeMin: from.toISOString(), timeMax: to.toISOString() } });
        try {
          localStorage.setItem(cacheKey(key), JSON.stringify(res));
          localStorage.setItem("tempo.lastDay", key);
        } catch {
          /* storage full */
        }
        return res;
      } catch (e) {
        const cached = localStorage.getItem(cacheKey(key));
        if (cached) return { ...(JSON.parse(cached) as EventsResult), offline: true };
        throw e;
      }
    },
    staleTime: 2 * 60_000,
    retry: 1,
  });
}

export function useManualBlocks(day: Date) {
  const key = localDateKey(day);
  return useQuery({
    queryKey: ["manual_blocks", key],
    queryFn: async () => {
      const { from, to } = dayRange(day);
      const { data, error } = await supabase
        .from("manual_blocks")
        .select("id, kind, start_at, end_at")
        .lt("start_at", to.toISOString())
        .gt("end_at", from.toISOString())
        .order("start_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useEventFlags(day: Date) {
  const key = localDateKey(day);
  return useQuery({
    queryKey: ["event_flags", key],
    queryFn: async () => {
      const { from, to } = dayRange(day);
      const { data, error } = await supabase
        .from("event_flags")
        .select("event_id, stressful")
        .lt("start_at", to.toISOString())
        .gt("end_at", from.toISOString());
      if (error) throw error;
      return data;
    },
  });
}

export function useDayEvents(day: Date, keywords: string[]) {
  const g = useGoogleDay(day);
  const m = useManualBlocks(day);
  const f = useEventFlags(day);
  const flags = new Map((f.data ?? []).map((x) => [x.event_id, x.stressful]));
  const events: DayEvent[] = [
    ...(g.data?.events ?? []).map((e) => ({ ...e, source: "google" as const, kind: "meeting" as const })),
    ...(m.data ?? []).map((b) => ({
      id: `manual:${b.id}`,
      title: b.kind === "meeting" ? "Meeting" : "Focus",
      start: b.start_at,
      end: b.end_at,
      allDay: false,
      source: "manual" as const,
      kind: b.kind as "meeting" | "focus",
    })),
  ]
    .map((e) => {
      const flagged = flags.has(e.id) ? flags.get(e.id)! : null;
      const auto = e.kind === "meeting" && e.source === "google" && matchesKeywords(e.title, keywords);
      return { ...e, flagged, stressful: e.kind === "meeting" && (flagged ?? auto) };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
  return {
    events,
    status: g.data?.status ?? (g.isError ? "error" : "loading"),
    offline: !!g.data?.offline,
    isLoading: g.isLoading || m.isLoading || f.isLoading,
    googleError: g.isError,
  };
}

export function useDayLogs(day: Date) {
  const key = localDateKey(day);
  return useQuery({
    queryKey: ["daylogs", key],
    queryFn: async () => {
      const { from, to } = dayRange(day);
      const [r, s, p] = await Promise.all([
        supabase.from("energy_ratings").select("id, kind, rating, event_id, primed, at").eq("local_date", key),
        supabase
          .from("focus_sessions")
          .select("id, actual_min, started_at")
          .gte("started_at", from.toISOString())
          .lt("started_at", to.toISOString()),
        supabase
          .from("prime_sessions")
          .select("id, event_id, at")
          .gte("at", from.toISOString())
          .lt("at", to.toISOString()),
      ]);
      if (r.error) throw r.error;
      if (s.error) throw s.error;
      if (p.error) throw p.error;
      // Merge rows still waiting in the offline queue.
      const pr = pendingRows("energy_ratings").filter((x) => x['local_date'] === key) as typeof r.data;
      const ps = pendingRows("focus_sessions").filter(
        (x) => String(x['started_at']) >= from.toISOString() && String(x['started_at']) < to.toISOString(),
      ) as typeof s.data;
      const pp = pendingRows("prime_sessions").filter(
        (x) => String(x['at']) >= from.toISOString() && String(x['at']) < to.toISOString(),
      ) as typeof p.data;
      return { ratings: [...r.data, ...pr], sessions: [...s.data, ...ps], primes: [...p.data, ...pp] };
    },
  });
}
