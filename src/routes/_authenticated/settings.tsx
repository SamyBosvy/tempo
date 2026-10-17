import { InstallTempo } from "@/components/tempo/InstallTempo";
import { PushControls } from "@/components/tempo/PushControls";
import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, X, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSettings, useSaveSettings, type Settings } from "@/lib/settings";
import { disconnectGoogle, getCalendarList } from "@/lib/google.functions";
import { deleteMyAccount } from "@/lib/access.functions";
import { exportMyData, exportFocusSessionsCsv, exportEnergyRatingsCsv } from "@/lib/export";
import { permissionLabel, showAppNotification, type NotifyPermission } from "@/lib/notify";
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
import { copyMondayToWeekdays, dayError, DAY_NAMES, resolveWorkHours, WEEK_ORDER, type WorkHours } from "@/lib/work-hours";
import { getCalendarEvents } from "@/lib/google.functions";
import { fmtTime, keywordMatch } from "@/lib/timeline";
import { mondayKey } from "@/lib/insights-rules";
import { localDateFromKey } from "@/lib/fix-rules";
import { discardAttention, retryAttention, useAttentionRows, useQueueSize, flush, pendingRows, attentionRows } from "@/lib/offline-queue";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet';
import { addKeyword } from '@/lib/settings-rules';
import { useLastSynced } from '@/lib/sync-status';
import { APP_VERSION } from '@/lib/version';

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: z.object({ google: z.string().optional() }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
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
    <section id={`settings-${title.toLowerCase().replaceAll(" ", "-")}`} aria-labelledby={title} className="scroll-mt-20 space-y-3">
      <h2 id={title} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="space-y-4 border-t border-subtle pt-4">{children}</div>
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
      <nav aria-label="Settings sections" className="sticky top-0 z-20 -mx-4 flex gap-1 overflow-x-auto border-b border-subtle bg-background px-4 py-2">
        {['Your day','Focus','Breathing','Google Calendar','Notifications','Appearance','Account','Privacy',...(role==='owner'?['Access']:[]),'About Tempo'].map(title => <Button key={title} variant="secondary" size="sm" className="h-10 shrink-0 px-3 text-xs" onClick={()=>document.getElementById(`settings-${title.toLowerCase().replaceAll(' ','-')}`)?.scrollIntoView({block:'start'})}>{title}</Button>)}
      </nav>
      <DaySection s={s} />
      <FocusSection s={s} />
      <BreathSection s={s} />
      <CalendarSection s={s} />
      <NotificationSection s={s} />
      <AppearanceSection s={s} />
      <AccountSection />
      <PrivacySection />
      {role === "owner" && (
        <Section title="Access">
          <Link to="/access" className="flex h-12 items-center justify-between font-semibold">
            Manage invites and members <ChevronRight className="h-5 w-5" aria-hidden />
          </Link>
        </Section>
      )}
      <Section title="About Tempo">
        {SAFETY_TEXT.map((p) => <p key={p} className="text-sm text-muted-foreground">{p}</p>)}
      </Section>
      <SyncSection />
    </div>
  );
}

const TABLE_LABEL: Record<string, string> = { focus_sessions: "Focus session", interruptions: "Interruption", energy_ratings: "Energy rating", prime_sessions: "Prime" };

function AttentionSection() {
  const rows = useAttentionRows();
  if (!rows.length) return null;
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Needs attention</h3>
      <p className="text-sm text-muted-foreground">These entries couldn't be saved after 3 tries. Everything else is still syncing.</p>
      <ul className="space-y-2">
        {rows.map((o) => {
          const at = (o.row["started_at"] ?? o.row["at"]) as string | undefined;
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
    </div>
  );
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.replace("/");
}

function AccountSection() {
  const [securityOpen, setSecurityOpen] = useState(false);
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
      <Button variant="outline" className="w-full justify-between" onClick={()=>setSecurityOpen(true)}>Account security<ChevronRight/></Button>
      <Button variant="outline" className="w-full" onClick={signOut}>Sign out</Button>
      <Sheet open={securityOpen} onOpenChange={setSecurityOpen}>
        <SheetContent side="bottom" className="mx-auto flex max-h-[90dvh] max-w-lg flex-col gap-4 rounded-t-xl p-0 pb-[env(safe-area-inset-bottom)]">
          <SheetHeader className="shrink-0 px-5 pt-5 text-left"><SheetTitle>Account security</SheetTitle><SheetDescription>Change your password or email.</SheetDescription></SheetHeader>
          <div className="min-h-0 space-y-6 overflow-y-auto px-5">
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
        <Input id="ne" type="email" autoComplete="email" placeholder="New email" className="h-12" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <Label htmlFor="cp2" className="sr-only">Current password</Label>
        <Input id="cp2" type="password" autoComplete="current-password" placeholder="Current password" className="h-12" value={cur2} onChange={(e) => setCur2(e.target.value)} />
        <Button type="submit" variant="secondary" className="w-full">Update email</Button>
        {msg && <p role="status" className="text-sm text-accent-text">{msg}</p>}
      </form>
          </div>
          <footer className="shrink-0 border-t border-subtle bg-background p-4"><SheetClose asChild><Button className="min-h-12 w-full">Done</Button></SheetClose></footer>
        </SheetContent>
      </Sheet>
    </Section>
  );
}

function DaySection({ s }: { s: Settings }) {
  const save = useSaveSettings();
  return (
    <Section title="Your day">
      <WeeklyHours s={s} />
      <div className="space-y-1.5">
        <span className="font-medium" id="buf-label">Buffer after meetings</span>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="buf-label">
          {[0, 5, 10].map((m) => (
            <Button key={m} role="radio" aria-checked={s.meeting_buffer_min === m} variant={s.meeting_buffer_min === m ? "default" : "outline"} onClick={() => save.mutate({ meeting_buffer_min: m })}>
              {m} min
            </Button>
          ))}
        </div>
      </div>


    </Section>
  );
}

function FocusSection({ s }: { s: Settings }) {
  const save = useSaveSettings();
  const [custom, setCustom] = useState(s.custom_interruption ?? "");
  return (
    <Section title="Focus">
      <Stepper label="Daily focus target" value={s.daily_focus_target_min} unit="min" min={30} max={480} step={30} onChange={(v) => save.mutate({ daily_focus_target_min: v })} />
      <Stepper label="Minimum focus length" value={s.min_focus_min} unit="min" min={10} max={120} step={5} onChange={(v) => save.mutate({ min_focus_min: v })} />
      <Toggle label="Keep screen awake during focus" checked={s.wake_lock} onChange={(v) => save.mutate({ wake_lock: v })} />
      <div className="space-y-1.5">
        <Label htmlFor="custom-int">Your own interruption reason</Label>
        <Input id="custom-int" maxLength={30} className="h-12" placeholder="e.g. Kids" value={custom} onChange={(e) => setCustom(e.target.value)}
          onBlur={() => {
            const v = custom.trim().slice(0, 30) || null;
            if (v !== (s.custom_interruption ?? null)) save.mutate({ custom_interruption: v });
          }} />
        <p className="text-xs text-muted-foreground">Shown as an extra choice in "What happened?". Up to 30 characters.</p>
      </div>
    </Section>
  );
}

function BreathSection({ s }: { s: Settings }) {
  const save = useSaveSettings();
  return (
    <Section title="Breathing">
      <Stepper label="Prime lead time" value={s.prime_lead_min} unit="min" min={5} max={30} step={5} onChange={(v) => save.mutate({ prime_lead_min: v })} />
      <div className="grid gap-2" role="radiogroup" aria-label="Default pattern">
        {(Object.keys(PATTERNS) as BreathPattern[]).map((p) => (
          <Button variant="outline" key={p} role="radio" aria-checked={s.breath_pattern === p} onClick={() => save.mutate({ breath_pattern: p })}
            className={cn("tap h-auto flex-col items-start whitespace-normal rounded-xl border px-3 py-3 text-left font-semibold", s.breath_pattern === p ? "border-primary bg-accent" : "border-border")}>
            {PATTERNS[p].name}
            {PATTERNS[p].when && <span className="block text-sm font-normal text-muted-foreground">{PATTERNS[p].when}</span>}
          </Button>
        ))}
      </div>
      <Stepper label="Length" value={s.breath_minutes} unit="min" min={1} max={5} step={1} onChange={(v) => save.mutate({ breath_minutes: v })} />

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
      <KeywordChips s={s} />
      <KeywordPreview s={s} />
      {cals.isLoading ? (
        <div role="status" aria-busy="true" className="h-12 animate-enter rounded-xl bg-secondary"><span className="sr-only">Loading</span></div>
      ) : connected ? (
        <>
          <p className="text-sm">Connected{s.google_email ? <> as <span className="font-semibold">{s.google_email}</span></> : ""}. Read-only.</p>
          <fieldset className="space-y-2">
            <legend className="mb-1 font-semibold">Calendars to include</legend>
            {cals.data?.calendars.map((c) => {
              const on = s.calendar_ids.includes(c.id);
              return (
                <label key={c.id} className="flex min-h-12 items-center gap-3">
                  <Checkbox checked={on} onCheckedChange={(v) => {
                    const next = v ? [...s.calendar_ids, c.id] : s.calendar_ids.filter((x) => x !== c.id);
                    save.mutate({ calendar_ids: next.length ? next : ["primary"] }, { onSuccess: () => qc.invalidateQueries({ queryKey: ["gcal"] }) });
                  }} className="h-6 w-6" />
                  <span aria-hidden className="h-4 w-4 shrink-0 rounded-full border border-subtle" style={c.color ? { backgroundColor: c.color } : undefined} />
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
      <OfflineItems />
      <AttentionSection />
      <Button variant="secondary" className="w-full" onClick={doExport}>Export my data (JSON)</Button>
      <Button variant="secondary" className="w-full" onClick={async () => { try { await exportFocusSessionsCsv(); } catch { toast.error("Export failed. Try again."); } }}>Export focus sessions (CSV)</Button>
      <Button variant="secondary" className="w-full" onClick={async () => { try { await exportEnergyRatingsCsv(); } catch { toast.error("Export failed. Try again."); } }}>Export energy ratings (CSV)</Button>
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

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} className="shrink-0" />
    </label>
  );
}

function NotificationSection({ s }: { s: Settings }) {
  const save = useSaveSettings();
  const [perm, setPerm] = useState<NotifyPermission>(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));
  async function ask() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p !== "granted") toast.error("Notifications are blocked in your browser settings.");
  }
  async function test() {
    const ok = await showAppNotification("Tempo", { body: "Test notification. You're all set.", tag: "tempo-test", url: "/settings" });
    if (!ok) toast.error("Couldn't show a notification. Check the permission above.");
  }
  return (
    <Section title="Notifications">
      <p className="text-sm" role="status">Permission: <span className="font-semibold">{permissionLabel(perm)}</span></p>
      {perm === "default" && <Button variant="secondary" className="w-full" onClick={ask}>Allow notifications</Button>}
      {perm === "denied" && <p className="text-sm text-muted-foreground">Blocked — enable notifications for Tempo in your browser settings.</p>}
      <Button variant="outline" className="w-full" disabled={perm !== "granted"} onClick={test}>Send test notification</Button>
      <PushControls settings={s} />
      <ToggleRow label="Prime reminders" desc="Before stressful meetings." checked={s.notifications} onChange={(v) => save.mutate({ notifications: v })} />
      <ToggleRow label="Focus end sound" desc="A soft chime when a focus session ends." checked={s.end_sound} onChange={(v) => save.mutate({ end_sound: v })} />
      <ToggleRow label="Focus end notification" desc="A notification when a focus session ends." checked={s.end_notify} onChange={(v) => save.mutate({ end_notify: v })} />
      <ToggleRow label="After-meeting check-in" desc="When a stressful meeting ends unrated." checked={s.checkin_notify} onChange={(v) => save.mutate({ checkin_notify: v })} />
      <ToggleRow label="Weekly review" desc="Monday morning. Links to Insights → Last week." checked={s.weekly_review_notify} onChange={(v) => save.mutate({ weekly_review_notify: v })} />
      <ToggleRow label="Soft vibration" desc="Gentle haptics with sounds and cues." checked={s.vibration} onChange={(v) => save.mutate({ vibration: v })} />
    </Section>
  );
}
function AppearanceSection({s}:{s:Settings}) {
  const save=useSaveSettings();
  return <Section title="Appearance"><div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">{(['system','dark','light'] as const).map(theme=><Button key={theme} role="radio" aria-checked={s.theme===theme} variant={s.theme===theme?'default':'outline'} onClick={()=>save.mutate({theme})}>{theme.charAt(0).toUpperCase()+theme.slice(1)}</Button>)}</div><InstallTempo permanent /></Section>;
}
function KeywordChips({s}:{s:Settings}) {
  const save=useSaveSettings(),[input,setInput]=useState(''),[error,setError]=useState('');
  function add(){const result=addKeyword(s.keywords,input);if(!result.ok){setError(result.error);return;}save.mutate({keywords:result.keywords});setInput('');setError('');}
  return <div className="space-y-2"><Label htmlFor="kw">Stressful-meeting keywords</Label><ul className="flex flex-wrap gap-2">{s.keywords.map(keyword=><li key={keyword} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-subtle bg-secondary pl-2"><span className="min-w-0 break-all text-sm">{keyword}</span><Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`Remove keyword ${keyword}`} onClick={()=>{save.mutate({keywords:s.keywords.filter(k=>k!==keyword)});setError('');}}><X className="h-4 w-4"/></Button></li>)}</ul><div className="flex gap-2"><Input id="kw" aria-label="Add keyword" placeholder="Add keyword" maxLength={40} value={input} aria-invalid={!!error} aria-describedby={error?'keyword-error':undefined} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add();}}}/><Button variant="outline" size="icon" aria-label="Add keyword" onClick={add}><Plus/></Button></div>{error&&<p id="keyword-error" role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
function OfflineItems(){const count=useQueueSize();return <p role="status" className="text-sm text-muted-foreground">{count?`${count} offline ${count===1?'entry':'entries'} waiting to sync.`:'No offline entries waiting.'}</p>;}
function SyncSection(){
 const qc=useQueryClient(),last=useLastSynced(),[busy,setBusy]=useState(false);
 async function sync(){setBusy(true);try{if(!navigator.onLine)throw new Error('offline');await flush();await qc.refetchQueries({type:'active'}, {throwOnError:true});if(Object.keys(TABLE_LABEL).some(table=>pendingRows(table as Parameters<typeof pendingRows>[0]).length)||attentionRows().length){toast.error('Some entries still need attention. Check Privacy.');}else toast.success('Synced.');}catch{toast.error("Couldn't sync. Try again when you're online.");}finally{setBusy(false);}}
 return <footer className="space-y-3 border-t border-subtle pt-4 text-sm"><p className="text-muted-foreground">Tempo {APP_VERSION}</p><p role="status">{last?`Last synced ${new Date(last).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`:'Not synced yet'}</p><Button variant="outline" className="w-full" disabled={busy} onClick={sync}><RefreshCw className={busy?'animate-spin':''}/>{busy?'Syncing…':'Sync now'}</Button></footer>;
}

function WeeklyHours({ s }: { s: Settings }) {
  const save = useSaveSettings();
  const stored = resolveWorkHours(s);
  const [draft, setDraft] = useState<WorkHours>(stored);
  function commit(next: WorkHours) {
    const valid: WorkHours = {};
    for (let d = 0; d < 7; d++) valid[d] = dayError(next[d]!) ? stored[d]! : next[d]!;
    if (JSON.stringify(valid) !== JSON.stringify(stored)) save.mutate({ work_hours: valid });
  }
  const set = (d: number, patch: Partial<WorkHours[string]>, now = false) => {
    const next = { ...draft, [d]: { ...draft[d]!, ...patch } };
    setDraft(next);
    if (now) commit(next);
  };
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 font-semibold">Working hours</legend>
      {WEEK_ORDER.map((d) => {
        const h = draft[d]!;
        const err = dayError(h);
        const name = DAY_NAMES[d]!;
        return (
          <div key={d} className="rounded-xl border border-subtle p-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-h-12 w-28 items-center gap-2">
                <Switch checked={h.on} onCheckedChange={(v) => set(d, { on: v }, true)} aria-label={`Work on ${name}`} />
                <span className="text-sm font-medium">{name.slice(0, 3)}</span>
              </label>
              {h.on ? (
                <div className="flex w-full min-w-0 items-center gap-1">
                  <Input type="time" className="h-12 min-w-0 flex-1 px-2" aria-label={`${name} start`} value={h.start} aria-invalid={!!err} aria-describedby={err ? `wh-err-${d}` : undefined} onChange={(e) => set(d, { start: e.target.value })} onBlur={() => commit(draft)} />
                  <span aria-hidden className="text-muted-foreground">–</span>
                  <Input type="time" className="h-12 min-w-0 flex-1 px-2" aria-label={`${name} end`} value={h.end} aria-invalid={!!err} aria-describedby={err ? `wh-err-${d}` : undefined} onChange={(e) => set(d, { end: e.target.value })} onBlur={() => commit(draft)} />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Day off</span>
              )}
            </div>
            {err && <p id={`wh-err-${d}`} role="alert" className="mt-1 text-sm text-destructive">{err}</p>}
          </div>
        );
      })}
      <Button variant="outline" className="w-full" onClick={() => { const next = copyMondayToWeekdays(draft); setDraft(next); commit(next); }}>
        Copy Monday to weekdays
      </Button>
    </fieldset>
  );
}

function KeywordPreview({ s }: { s: Settings }) {
  const fetchEvents = useServerFn(getCalendarEvents);
  const monday = mondayKey();
  // Titles stay in memory only (query cache), never stored.
  const week = useQuery({
    queryKey: ["gcal", "week", monday, s.calendar_ids],
    queryFn: () => {
      const from = localDateFromKey(monday);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      return fetchEvents({ data: { timeMin: from.toISOString(), timeMax: to.toISOString() } });
    },
    staleTime: 5 * 60_000,
  });
  if (week.isLoading) return <div role="status" aria-busy="true" className="h-10 animate-enter rounded-xl bg-secondary"><span className="sr-only">Loading</span></div>;
  if (week.isError) return <p className="text-sm text-muted-foreground">Couldn't load this week's meetings.</p>;
  if (week.data?.status !== "connected") return <p className="text-sm text-muted-foreground">Connect Google Calendar to preview.</p>;
  const matches = week.data.events
    .filter((e) => !e.allDay)
    .map((e) => ({ e, m: keywordMatch(e.title, s.keywords) }))
    .filter((x) => x.m);
  return (
    <section aria-label="Matches this week" className="space-y-2">
      <p className="text-sm font-semibold" role="status">
        Matches this week · {matches.length ? `${matches.length} ${matches.length === 1 ? "meeting matches" : "meetings match"}` : "No meetings this week match"}
      </p>
      {matches.length > 0 && (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {matches.map(({ e, m }) => (
            <li key={e.id} className="rounded-lg bg-secondary px-3 py-2 text-sm">
              <span className="break-words">{m!.before}<mark className="rounded bg-gold px-0.5 text-gold-foreground">{m!.match}</mark>{m!.after}</span>
              <span className="block text-xs text-muted-foreground tabular">
                {new Date(e.start).toLocaleDateString("en-GB", { weekday: "short" })} {fmtTime(e.start)} · “{m!.keyword}”
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
