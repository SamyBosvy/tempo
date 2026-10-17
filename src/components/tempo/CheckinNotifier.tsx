import { deliverReminder } from "@/lib/push";
import { pendingRows, useQueueSize } from '@/lib/offline-queue';
import { reminderKey } from "@/lib/push-rules";
// After-meeting check-in: when a stressful meeting ends unrated while Tempo is
// open, nudge once per meeting. Dismissed check-ins never nudge.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDayEvents } from "@/lib/day-data";
import { useNow } from "@/lib/use-now";
import { showAppNotification } from "@/lib/notify";
import type { Settings } from "@/lib/settings";

const NOTIFIED_KEY = "tempo.checkinNotified";

function dayKeyLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function CheckinNotifier({ settings }: { settings: Settings }) {
  const queueSize = useQueueSize();
  const now = useNow(60_000);
  const today = dayKeyLocal(new Date());
  const { events } = useDayEvents(new Date(), settings.keywords);
  const done = useQuery({
    queryKey: ["checkin-notify", today],
    queryFn: async () => {
      const [{ data: ratings, error: e1 }, { data: dismissed, error: e2 }] = await Promise.all([
        supabase.from("energy_ratings").select("event_id").eq("kind", "after_meeting").eq("local_date", today),
        supabase.from("checkin_dismissals").select("event_id").eq("local_date", today),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return {
        rated: new Set((ratings ?? []).map((r) => r.event_id).filter(Boolean) as string[]),
        dismissed: new Set((dismissed ?? []).map((r) => r.event_id)),
      };
    },
    staleTime: 60_000,
  });
  useEffect(() => {
    if (!settings.checkin_notify || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!done.data) return;
    const queued = pendingRows('energy_ratings').filter(r=>r['local_date']===today&&r['kind']==='after_meeting');
    for (const e of events) {
      if (!e.stressful || e.allDay) continue;
      if (done.data.rated.has(e.id) || done.data.dismissed.has(e.id) || queued.some(r=>r['event_id']===e.id)) continue;
      const end = new Date(e.end).getTime();
      if (now >= end + 2 * 60_000) {
          void deliverReminder(settings.user_id,reminderKey('checkin',e.id,new Date(e.end).toISOString()),settings.push_enabled,`${NOTIFIED_KEY}.${settings.user_id}`,"Tempo", {
          body: "How was that meeting? One tap to rate it.",
          tag: `checkin-${e.id}`,
          url: "/today",
          });
      }
    }
  }, [now, events, done.data, settings.checkin_notify, settings.push_enabled, settings.user_id, today, queueSize]);
  return null;
}
