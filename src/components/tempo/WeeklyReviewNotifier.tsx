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
    if (d.getDay() !== 1 || d.getHours() < 8) return;
    const key = mondayKey(d);
    if (localStorage.getItem(`tempo.weekReview.${key}`)) return;
    if (localStorage.getItem(`tempo.weekReviewNotified.${key}`)) return;
    localStorage.setItem(`tempo.weekReviewNotified.${key}`, "1");
    void showAppNotification("Tempo", {
      body: "Your week in review is ready.",
      tag: `week-review-${key}`,
      url: "/insights",
    });
  }, [now, settings.weekly_review_notify]);
  return null;
}
