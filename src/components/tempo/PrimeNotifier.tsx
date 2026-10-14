// Browser notification at prime time while Tempo is open (foreground or background tab).
import { useEffect } from "react";
import { useDayEvents } from "@/lib/day-data";
import { fmtTime } from "@/lib/timeline";
import { useNow } from "@/lib/use-now";
import type { Settings } from "@/lib/settings";

export function PrimeNotifier({ settings }: { settings: Settings }) {
  const now = useNow(30_000);
  const { events } = useDayEvents(new Date(), settings.keywords);
  useEffect(() => {
    if (!settings.notifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const sent: string[] = JSON.parse(localStorage.getItem("tempo.notified") ?? "[]");
    for (const e of events) {
      if (!e.stressful) continue;
      const start = new Date(e.start).getTime();
      const lead = settings.prime_lead_min * 60_000;
      if (now >= start - lead && now < start && !sent.includes(e.id)) {
        new Notification("Tempo", { body: `Big one at ${fmtTime(e.start)}. Two minutes to settle?`, tag: e.id });
        sent.push(e.id);
      }
    }
    localStorage.setItem("tempo.notified", JSON.stringify(sent.slice(-50)));
  }, [now, events, settings.notifications, settings.prime_lead_min]);
  return null;
}
