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
