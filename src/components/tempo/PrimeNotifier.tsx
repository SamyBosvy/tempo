import { claimNotification } from "@/lib/push";
import { reminderKey } from "@/lib/push-rules";
// Prime reminder while Tempo is open (foreground or background tab), shown via the service worker.
import { useEffect } from "react";
import { useDayEvents } from "@/lib/day-data";
import { fmtTime } from "@/lib/timeline";
import { useNow } from "@/lib/use-now";
import { primeUrl, showAppNotification } from "@/lib/notify";
import type { Settings } from "@/lib/settings";

export function PrimeNotifier({ settings }: { settings: Settings }) {
  const now = useNow(30_000);
  const { events } = useDayEvents(new Date(), settings.keywords);
  useEffect(() => {
    if (!settings.notifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const sent: string[] = JSON.parse(localStorage.getItem("tempo.notified") ?? "[]");
    let changed = false;
    for (const e of events) {
      if (!e.stressful || e.allDay) continue;
      const start = new Date(e.start).getTime();
      const lead = settings.prime_lead_min * 60_000;
      if (now >= start - lead && now < start && !sent.includes(e.id)) {
        sent.push(e.id);
        changed = true;
        void (async () => {
          if (settings.push_enabled && !await claimNotification(reminderKey("prime",e.id,new Date(e.start).toISOString()))) return;
          await showAppNotification("Tempo", {
          body: `Big one at ${fmtTime(e.start)}. Two minutes to settle?`,
          tag: e.id,
          url: primeUrl(e.id, e.start),
          });
        })();
      }
    }
    if (changed) localStorage.setItem("tempo.notified", JSON.stringify(sent.slice(-50)));
  }, [now, events, settings.notifications, settings.prime_lead_min, settings.push_enabled]);
  return null;
}
