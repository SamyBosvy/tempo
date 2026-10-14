import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { CalendarClock, ChartLine, History, Timer, CloudOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSettings, useSaveSettings, type Settings } from "@/lib/settings";
import { useSafetyAcknowledgement } from "@/lib/safety-acknowledgement";
import { useFocusState, elapsedMs } from "@/lib/focus-timer";
import { useQueueSize } from "@/lib/offline-queue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SAFETY_TEXT } from "@/components/tempo/bits";
import { PrimeNotifier } from "@/components/tempo/PrimeNotifier";
import { GoogleConnectResult } from "@/components/tempo/GoogleConnectResult";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/", search: { next: location.pathname } as never });
    const { data: roles, error } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (error) throw error;
    if (!roles?.length) {
      await supabase.auth.signOut();
      throw redirect({ to: "/", search: { noaccess: 1 } as never });
    }
    return { user: data.user, role: roles.some((r) => r.role === "owner") ? "owner" : "member" };
  },
  component: AppShell,
});

const tabs = [
  { to: "/today", label: "Today", icon: CalendarClock },
  { to: "/focus", label: "Focus", icon: Timer },
  { to: "/insights", label: "Insights", icon: ChartLine },
  { to: "/history", label: "History", icon: History },
] as const;

function AppShell() {
  const { data: settings } = useSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const focus = useFocusState();
  const queued = useQueueSize();
  const now = useNow(1000);

  useEffect(() => {
    const light = settings?.theme === "light";
    document.documentElement.classList.toggle("light", light);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? "#F7F4EE" : "#0F1B2D");
  }, [settings?.theme]);

  const remaining = focus ? Math.max(0, focus.targetMin * 60_000 - elapsedMs(focus, now)) : 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col">
      <GoogleConnectResult />
      {(focus && pathname !== "/focus") || queued > 0 ? (
        <div className="sticky top-0 z-30 flex items-center justify-center gap-2 px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2">
          {focus && pathname !== "/focus" && (
            <Link
              to="/focus"
              className="tap inline-flex items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              <span className="h-2 w-2 rounded-full bg-primary-foreground animate-tick" aria-hidden />
              Focus · <span className="tabular">{fmtClock(remaining)}</span>
              {focus.paused && " · paused"}
            </Link>
          )}
          {queued > 0 && (
            <span role="status" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              <CloudOff className="h-4 w-4" aria-hidden /> Saved offline · will sync
            </span>
          )}
        </div>
      ) : null}
      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-subtle bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {tabs.map((t) => {
            const active = pathname.startsWith(t.to);
            return (
              <li key={t.to}>
                <Link
                  to={t.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
                    active ? "text-accent-text" : "text-muted-foreground",
                  )}
                >
                  <t.icon className="h-6 w-6" aria-hidden />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {settings && <SafetyModal key={settings.user_id} settings={settings} />}
      {settings && <PrimeNotifier settings={settings} />}
    </div>
  );
}

function fmtClock(ms: number) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

function SafetyModal({ settings }: { settings: Settings }) {
  const save = useSaveSettings();
  const { open, acknowledge } = useSafetyAcknowledgement({
    userId: settings.user_id,
    acknowledged: Boolean(settings.safety_ack_at),
    save: save.mutateAsync,
  });
  return (
    <Dialog open={open}>
      <DialogContent
        className="safety-dialog flex translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl p-0 [&>button]:hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-[20px] text-left">
          <DialogTitle className="mb-3 shrink-0 leading-snug tracking-normal">Before you begin</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-left text-muted-foreground">
              {SAFETY_TEXT.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </DialogDescription>
        </DialogHeader>
        <footer className="sticky bottom-0 shrink-0 border-t border-subtle bg-background p-[16px]">
          <Button size="lg" className="h-auto min-h-12 w-full whitespace-normal px-3 py-3" onClick={acknowledge}>
            I understand
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
