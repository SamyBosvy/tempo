import { deliverReminder } from "@/lib/push";
import { reminderKey, weeklyDue } from "@/lib/push-rules";
// Weekly review: one Monday-morning notification while Tempo is open, linking
// to Insights. Skipped when the review card was already dismissed this week.
import { useEffect } from "react";
import { useNow } from "@/lib/use-now";
import { showAppNotification } from "@/lib/notify";
import { mondayKey } from "@/lib/insights-rules";
import type { Settings } from "@/lib/settings";

export function WeeklyReviewNotifier({ settings }: { settings: Settings }) {
  const now = useNow(60_000);
  useEffect(() => {
    if (!settings.weekly_review_notify || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const d = new Date(now);
    if (!weeklyDue(d.getDay(),d.getHours())) return;
    const key = mondayKey(d);
    if (localStorage.getItem(`tempo.weekReview.${settings.user_id}.${key}`)) return;
      void deliverReminder(settings.user_id,reminderKey('weekly',key,''),settings.push_enabled,`tempo.weekReviewNotified.${settings.user_id}`,"Tempo", {
      body: "Your week in review is ready.",
      tag: `week-review-${key}`,
      url: "/insights#last-week",
      });
  }, [now, settings.weekly_review_notify, settings.push_enabled, settings.user_id]);
  return null;
}
