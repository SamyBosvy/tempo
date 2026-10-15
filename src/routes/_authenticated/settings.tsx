import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSettings, useSaveSettings, type Settings } from "@/lib/settings";
import { disconnectGoogle, getCalendarList } from "@/lib/google.functions";
import { deleteMyAccount } from "@/lib/access.functions";
import { exportMyData } from "@/lib/export";
import { PATTERNS, type BreathPattern } from "@/lib/breath";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, ScreenSkeleton, SAFETY_TEXT } from "@/components/tempo/bits";
import { ConnectGoogleButton } from "@/components/tempo/ConnectGoogle";
import { cn } from "@/lib/utils";
import { validWorkHours } from "@/lib/fix-rules";
import { discardAttention, retryAttention, useAttentionRows } from "@/lib/offline-queue";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: z.object({ google: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Settings · Tempo" },
      { name: "description", content: "Working hours, breathing, calendar and account." },
      { property: "og:title", content: "Settings · Tempo" },
      { property: "og:description", content: "Working hours, breathing, calendar and account." },
    ],
  }),
  component: SettingsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={title} className="space-y-3">
      <h2 id={title} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <Card className="space-y-4">{children}</Card>
    </section>
  );
}

function SettingsPage() {
  const { data: s } = useSettings();
  const { role } = useRouteContext({ from: "/_authenticated" });
  if (!s) return <ScreenSkeleton rows={6} />;
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Back to Today"><Link to="/today"><ChevronLeft /></Link></Button>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </header>
      <AttentionSection />
      <AccountSection />
      <DaySection s={s} />
      <BreathSection s={s} />
      <CalendarSection s={s} />
      {role === "owner" && (
        <Section title="Access">
          <Link to="/access" className="flex h-12 items-center justify-between font-semibold">
            Manage invites and members <ChevronRight className="h-5 w-5" aria-hidden />
          </Link>
        </Section>
      )}
      <PrivacySection />
      <Section title="About Tempo">
        {SAFETY_TEXT.map((p) => <p key={p} className="text-sm text-muted-foreground">{p}</p>)}
      </Section>
      <Button variant="outline" className="w-full" onClick={signOut}>Sign out</Button>
    </div>
  );
}

const TABLE_LABEL: Record<string, string> = { focus_sessions: "Focus session", interruptions: "Interruption", energy_ratings: "Energy rating", prime_sessions: "Prime" };

function AttentionSection() {
  const rows = useAttentionRows();
  if (!rows.length) return null;
  return (
    <Section title="Needs attention">
      <p className="text-sm text-muted-foreground">These entries couldn't be saved after 3 tries. Everything else is still syncing.</p>
      <ul className="space-y-2">
        {rows.map((o) => {
          const at = (o.row.started_at ?? o.row.at) as string | undefined;
          return (
            <li key={o.qid} className="space-y-2 rounded-xl border border-subtle p-3">
              <div className="font-semibold">{TABLE_LABEL[o.table] ?? o.table}{at ? ` · ${new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => void retryAttention(o.qid)}>Retry</Button>
                <Button variant="ghost" className="text-destructive" onClick={() => discardAttention(o.qid)}>Discard</Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.replace("/");
}

function AccountSection() {
  const [email, setEmail] = useState("");
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [cur2, setCur2] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function verify(p: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: p });
    return !error;
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (!(await verify(cur))) { toast.error("Current password is wrong."); return; }
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: cur } as never);
    if (error) { toast.error("Something went wrong. Try again."); return; }
    setCur(""); setPw("");
    toast.success("Password changed.");
  }
  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!z.string().email().safeParse(newEmail.trim()).success) { toast.error("Enter a valid email."); return; }
    if (!(await verify(cur2))) { toast.error("Current password is wrong."); return; }
    sessionStorage.setItem("tempo.emailChange", "1");
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim().toLowerCase() }, { emailRedirectTo: `${window.location.origin}/settings` });
    if (error) { toast.error("Something went wrong. Try again."); return; }
    setCur2(""); setNewEmail("");
    setMsg("Check your inbox to confirm the change.");
  }

  return (
    <Section title="Account">
      <p className="text-sm text-muted-foreground">Signed in as <span className="text-foreground">{email}</span></p>
      <form onSubmit={changePw} className="space-y-2">
        <p className="font-semibold">Change password</p>
        <Label htmlFor="cp" className="sr-only">Current password</Label>
        <Input id="cp" type="password" autoComplete="current-password" placeholder="Current password" className="h-12" value={cur} onChange={(e) => setCur(e.target.value)} />
        <Label htmlFor="np" className="sr-only">New password</Label>
        <Input id="np" type="password" autoComplete="new-password" placeholder="New password (8+)" className="h-12" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button type="submit" variant="secondary" className="w-full">Update password</Button>
      </form>
      <form onSubmit={changeEmail} className="space-y-2">
        <p className="font-semibold">Change email</p>
        <Label htmlFor="ne" className="sr-only">New email</Label>
        <Input id="ne" type="email" placeholder="New email" className="h-12" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <Label htmlFor="cp2" className="sr-only">Current password</Label>
        <Input id="cp2" type="password" autoComplete="current-password" placeholder="Current password" className="h-12" value={cur2} onChange={(e) => setCur2(e.target.value)} />
        <Button type="submit" variant="secondary" className="w-full">Update email</Button>
        {msg && <p role="status" className="text-sm text-accent-text">{msg}</p>}
      </form>
    </Section>
  );
}

function DaySection({ s }: { s: Settings }) {
  const save = useSaveSettings();
  const [kw, setKw] = useState(s.keywords.join(", "));
  const [ws, setWs] = useState(s.work_start.slice(0, 5));
  const [we, setWe] = useState(s.work_end.slice(0, 5));
  const hoursOk = validWorkHours(ws, we);
  const saveHours = () => {
    if (!ws || !we || !hoursOk) return;
    if (ws === s.work_start.slice(0, 5) && we === s.work_end.slice(0, 5)) return;
    save.mutate({ work_start: ws, work_end: we });
  };
  return (
    <Section title="Your day">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ws">Work starts</Label>
          <Input id="ws" type="time" className="h-12" value={ws} aria-invalid={!hoursOk} aria-describedby={!hoursOk ? "hours-err" : undefined} onChange={(e) => setWs(e.target.value)} onBlur={saveHours} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="we">Work ends</Label>
          <Input id="we" type="time" className="h-12" value={we} aria-invalid={!hoursOk} aria-describedby={!hoursOk ? "hours-err" : undefined} onChange={(e) => setWe(e.target.value)} onBlur={saveHours} />
        </div>
      </div>
      {!hoursOk && <p id="hours-err" role="alert" className="text-sm text-destructive">Work end must be after work start. Not saved.</p>}
      <Stepper label="Minimum focus length" value={s.min_focus_min} unit="min" min={10} max={120} step={5} onChange={(v) => save.mutate({ min_focus_min: v })} />
      <Stepper label="Prime lead time" value={s.prime_lead_min} unit="min" min={5} max={30} step={5} onChange={(v) => save.mutate({ prime_lead_min: v })} />
      <div className="space-y-1.5">
        <Label htmlFor="kw">Stressful-meeting keywords</Label>
        <Input id="kw" className="h-12" value={kw} onChange={(e) => setKw(e.target.value)}
          onBlur={() => save.mutate({ keywords: kw.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 30) })} />
        <p className="text-xs text-muted-foreground">Comma-separated. Matched on this device; titles aren't stored.</p>
      </div>
      <Toggle label="Prime reminders (while Tempo is open)" checked={s.notifications} onChange={async (v) => {
        if (v && typeof Notification !== "undefined" && Notification.permission !== "granted") {
          const p = await Notification.requestPermission();
          if (p !== "granted") { toast.error("Notifications are blocked in your browser settings."); return; }
        }
        save.mutate({ notifications: v });
      }} />
      <Toggle label="Light mode" checked={s.theme === "light"} onChange={(v) => save.mutate({ theme: v ? "light" : "dark" })} />
    </Section>
  );
}

function BreathSection({ s }: { s: Settings }) {
  const save = useSaveSettings();
  return (
    <Section title="Breathing">
      <div className="grid gap-2" role="radiogroup" aria-label="Default pattern">
        {(Object.keys(PATTERNS) as BreathPattern[]).map((p) => (
          <button key={p} role="radio" aria-checked={s.breath_pattern === p} onClick={() => save.mutate({ breath_pattern: p })}
            className={cn("tap rounded-xl border px-3 text-left font-semibold", s.breath_pattern === p ? "border-primary bg-accent" : "border-border")}>
            {PATTERNS[p].name}
          </button>
        ))}
      </div>
      <Stepper label="Length" value={s.breath_minutes} unit="min" min={1} max={5} step={1} onChange={(v) => save.mutate({ breath_minutes: v })} />
      <Toggle label="Soft vibration" checked={s.vibration} onChange={(v) => save.mutate({ vibration: v })} />
    </Section>
  );
}

function CalendarSection({ s }: { s: Settings }) {
  const qc = useQueryClient();
  const save = useSaveSettings();
  const list = useServerFn(getCalendarList);
  const disconnect = useServerFn(disconnectGoogle);
  const cals = useQuery({ queryKey: ["calendars"], queryFn: () => list() });
  const [busy, setBusy] = useState(false);
  const connected = cals.data?.status === "connected";
  return (
    <Section title="Google Calendar">
      {cals.isLoading ? (
        <div role="status" aria-busy="true" className="h-12 animate-pulse rounded-xl bg-secondary"><span className="sr-only">Loading</span></div>
      ) : connected ? (
        <>
          <p className="text-sm">Connected{s.google_email ? <> as <span className="font-semibold">{s.google_email}</span></> : ""}. Read-only.</p>
          <fieldset className="space-y-2">
            <legend className="mb-1 font-semibold">Calendars to include</legend>
            {cals.data!.calendars.map((c) => {
              const on = s.calendar_ids.includes(c.id);
              return (
                <label key={c.id} className="flex min-h-12 items-center gap-3">
                  <Checkbox checked={on} onCheckedChange={(v) => {
                    const next = v ? [...s.calendar_ids, c.id] : s.calendar_ids.filter((x) => x !== c.id);
                    save.mutate({ calendar_ids: next.length ? next : ["primary"] }, { onSuccess: () => qc.invalidateQueries({ queryKey: ["gcal"] }) });
                  }} className="h-6 w-6" />
                  <span>{c.name}</span>
                </label>
              );
            })}
          </fieldset>
          <Button variant="outline" className="w-full" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              await disconnect();
              await qc.invalidateQueries();
              toast.success("Google Calendar disconnected.");
            } catch {
              toast.error("Couldn't disconnect. Try again.");
            } finally {
              setBusy(false);
            }
          }}>Disconnect Google Calendar</Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{cals.data?.status === "reconnect" ? "Calendar disconnected. Reconnect to see your day." : "Not connected."}</p>
          <ConnectGoogleButton label={cals.data?.status === "reconnect" ? "Reconnect Google Calendar" : "Connect Google Calendar"} />
        </>
      )}
    </Section>
  );
}

function PrivacySection() {
  const navigate = useNavigate();
  const del = useServerFn(deleteMyAccount);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function doExport() {
    try {
      await exportMyData();
    } catch {
      toast.error("Export failed. Try again.");
    }
  }
  return (
    <Section title="Privacy">
      <p className="text-sm text-muted-foreground">
        Tempo reads your calendar only to show your day and find focus time. Event details are not stored. Your data is private, not shared, not sold. No analytics or trackers.
      </p>
      <Button variant="secondary" className="w-full" onClick={doExport}>Export my data</Button>
      <Button variant="outline" className="w-full text-destructive" onClick={() => setOpen(true)}>Delete account</Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete everything?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes your account and all your data, and disconnects Google. It can't be undone. Export first if you want a copy.</AlertDialogDescription>
          </AlertDialogHeader>
          <Button variant="secondary" onClick={doExport}>Export my data first</Button>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12">Keep my account</AlertDialogCancel>
            <AlertDialogAction className="h-12 bg-destructive text-destructive-foreground" disabled={busy} onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await del();
                await supabase.auth.signOut();
                localStorage.clear();
                navigate({ to: "/", replace: true });
              } catch {
                toast.error("Couldn't delete the account. Try again.");
                setBusy(false);
              }
            }}>Delete permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}

function Stepper({ label, value, unit, min, max, step, onChange }: { label: string; value: number; unit: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>−</Button>
        <span className="w-16 text-center tabular font-semibold" aria-live="polite">{value} {unit}</span>
        <Button variant="outline" size="icon" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>+</Button>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3">
      <span className="font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
