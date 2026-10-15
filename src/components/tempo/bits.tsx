import { cn } from "@/lib/utils";

export function EnergyPicker({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`Energy ${n} of 5`}
          onClick={() => onChange(n)}
          className={cn(
            "h-12 min-w-0 flex-1 rounded-xl border text-lg font-semibold tabular transition-colors",
            value === n
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-accent",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-subtle bg-card p-4", className)} {...p} />;
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-2xl bg-secondary", className)} />;
}

export function ScreenSkeleton({ rows = 5, header = true }: { rows?: number; header?: boolean }) {
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <span className="sr-only">Loading</span>
      {header && <SkeletonBlock className="h-8 w-40" />}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock key={i} className={i % 2 ? "h-14" : "h-24"} />
      ))}
    </div>
  );
}

export function PageTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="mb-4 flex items-center justify-between gap-2">
      <h1 className="text-2xl font-semibold">{children}</h1>
      {right}
    </header>
  );
}

export const SAFETY_TEXT = [
  "Tempo is a self-help tool for focus and stress around work. It is not therapy, is not provided by a licensed professional, and isn't a substitute for professional or medical care.",
  "If work stress is affecting your health, consider speaking with a GP or qualified therapist.",
  "If you're in crisis, contact local emergency services or findahelpline.com.",
];
