import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Card } from "./bits";
import { Button } from "@/components/ui/button";
import { useInsights, useInsightCalendar } from "@/lib/insights-data";
import {
  hourLabel,
  signed,
  weeklySuggestion,
  mondayKey,
  primedDifference,
  type InsightData,
} from "@/lib/insights-rules";
import { fmtDuration } from "@/lib/timeline";
export function WeeklyReviewContent({
  d,
  load,
  calendarKnown,
}: {
  d: InsightData;
  load: number | null;
  calendarKnown: boolean;
}) {
  const w = d.last_week,
    prev = d.previous_week;
  const min = w.completion.actual,
    delta = min - prev.completion.actual,
    best = w.findings.best,
    p = primedDifference(w.primed),
    o = w.intent_outcomes,
    n = o.yes + o.partly + o.no;
  return (
    <div className="space-y-2 text-sm">
      <p className="text-lg font-semibold tabular">
        {fmtDuration(min)} focus{" "}
        <span className="text-sm font-normal text-muted-foreground">
          · {signed(delta / 60)}h vs week before
        </span>
      </p>
      <p>
        {best
          ? `Best window · ${hourLabel(best.hour)}–${hourLabel(best.hour + 1)} · energy ${best.avg_energy}`
          : "Best window · not enough data yet."}
      </p>
      <p>
        Meeting load ·{" "}
        {calendarKnown && load !== null
          ? `${Math.round(load)}% of weekday work hours`
          : "calendar unavailable"}
      </p>
      <p>
        {p !== null
          ? `Primed vs not · ${signed(p)} energy`
          : `Too few to compare yet (${w.primed.primed_n} primed, ${w.primed.unprimed_n} not).`}
      </p>
      <p>
        {n
          ? `Intention outcomes · ${o.yes} yes / ${o.partly} partly / ${o.no} no`
          : "Intention outcomes · none logged."}
      </p>
      <p className="border-t border-subtle pt-3 text-accent-text">
        {weeklySuggestion(best, load, w.findings.interruption)}
      </p>
    </div>
  );
}
export function MondayReview() {
  const q = useInsights("30"),
    cal = useInsightCalendar(q.data);
  const week = mondayKey();
  const [dismissed, setDismissed] = useState(true);
  const key = `tempo.weekReview.${week}`;
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
  }, [key]);
  if (dismissed || !q.data) return null;
  const load = cal.data?.weeks.find((w) => w.week === q.data?.last_week.start)?.load ?? null;
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Last week</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss weekly review"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(key, "1");
            } catch {
              /* session dismissal remains */
            }
          }}
        >
          <X />
        </Button>
      </div>
      <WeeklyReviewContent
        d={q.data}
        load={load}
        calendarKnown={cal.data?.status === "connected"}
      />
    </Card>
  );
}
