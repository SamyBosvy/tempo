import type { RibbonSegment } from "@/lib/timeline";
import { cn } from "@/lib/utils";

// A work day as a rounded bar: grey meetings, teal focus windows, one gold big meeting.
const BLOCKS: { x: number; w: number; kind: "meeting" | "focus" | "big" }[] = [
  { x: 4, w: 30, kind: "focus" },
  { x: 37, w: 12, kind: "meeting" },
  { x: 52, w: 44, kind: "focus" },
  { x: 99, w: 16, kind: "big" },
  { x: 118, w: 10, kind: "meeting" },
  { x: 131, w: 38, kind: "focus" },
  { x: 172, w: 14, kind: "meeting" },
  { x: 189, w: 27, kind: "focus" },
];
const FILL = { meeting: "var(--color-muted-foreground)", focus: "var(--color-primary)", big: "var(--color-gold)" };

/** Decorative ribbon for the landing and loading screens. */
export function DayRibbon({ animate = true, className }: { animate?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 220 28"
      className={`day-ribbon ${className ?? ""}`}
      data-animate={animate ? "true" : "false"}
      aria-hidden
    >
      <rect x="0" y="0" width="220" height="28" rx="14" fill="var(--color-secondary)" />
      {BLOCKS.map((b, i) => (
        <rect
          key={i}
          className="day-ribbon-block"
          x={b.x}
          y="5"
          width={b.w}
          height="18"
          rx="9"
          fill={FILL[b.kind]}
          opacity={b.kind === "meeting" ? 0.55 : 1}
          style={{ ["--d" as string]: `${(b.x / 216) * 3}s` }}
        />
      ))}
    </svg>
  );
}

const SEG_CLASS: Record<RibbonSegment["kind"], string> = {
  meeting: "bg-muted-foreground/55",
  stressful: "bg-gold",
  focus: "bg-primary",
  "manual-focus": "border-2 border-primary bg-transparent",
};
const SEG_LABEL: Record<RibbonSegment["kind"], string> = {
  meeting: "Meeting",
  stressful: "Stressful meeting",
  focus: "Focus window",
  "manual-focus": "Focus block",
};

/** The real day: work start to work end, tappable segments and an optional "now" marker. */
export function DayRibbonLive({
  segments,
  nowFrac,
  startLabel,
  endLabel,
  onSegment,
}: {
  segments: (RibbonSegment & { title: string })[];
  nowFrac: number | null;
  startLabel: string;
  endLabel: string;
  onSegment: (id: string) => void;
}) {
  return (
    <div>
      <div className="relative h-8 rounded-full bg-secondary" role="group" aria-label="Your working day">
        {segments.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSegment(s.id)}
            aria-label={`${SEG_LABEL[s.kind]}: ${s.title}`}
            className={cn("absolute top-1 bottom-1 rounded-full", SEG_CLASS[s.kind])}
            style={{ left: `${s.x * 100}%`, width: `max(6px, ${s.w * 100}%)`, ...(s.color ? { backgroundColor: s.color } : {}) }}
          />
        ))}
        {nowFrac !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground transition-[left] duration-700"
            style={{ left: `${nowFrac * 100}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}
