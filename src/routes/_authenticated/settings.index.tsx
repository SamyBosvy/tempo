import { createFileRoute, Link, useRouteContext } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AlertTriangle, Bell, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Database, Info, Palette, ShieldCheck, Timer, UserRound, Wind, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InstallTempo } from '@/components/tempo/InstallTempo';
import { ScreenSkeleton } from '@/components/tempo/bits';
import { settingsHead } from '@/components/tempo/settings/page';
import { useSettings, useSaveSettings } from '@/lib/settings';
import { getCalendarList } from '@/lib/google.functions';
import { useAttentionRows, useQueueSize } from '@/lib/offline-queue';
import { breathingSummary, calendarSummary, dataSummary, daySummary, focusSummary, notificationSummary } from '@/lib/settings-summaries';
import { APP_VERSION } from '@/lib/version';

export const Route = createFileRoute('/_authenticated/settings/')({
  head: () => settingsHead('Settings', 'Your work, app preferences and private account settings.'),
  component: SettingsMenu,
});

type SettingsDestination = '/settings/day' | '/settings/focus' | '/settings/breathing' | '/settings/calendar' | '/settings/notifications' | '/settings/account' | '/settings/data' | '/settings/about' | '/access';

function MenuRow({ icon: Icon, title, summary, to }: { icon: LucideIcon; title: string; summary: string; to: SettingsDestination }) {
  return <Button asChild variant="ghost" className="h-auto min-h-16 w-full justify-start gap-3 rounded-none px-4 py-3 text-left">
    <Link to={to}>
      <Icon aria-hidden className="text-muted-foreground" />
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block truncate text-xs font-normal leading-5 text-muted-foreground">{summary}</span></span>
      <ChevronRight aria-hidden className="text-muted-foreground" />
    </Link>
  </Button>;
}

function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section aria-label={title} className="space-y-2">
    <h2 className="px-4 text-xs font-medium text-muted-foreground">{title}</h2>
    <div className="overflow-hidden rounded-2xl border border-subtle bg-card shadow-card divide-y divide-subtle">{children}</div>
  </section>;
}

function SettingsMenu() {
  const { data: s } = useSettings();
  const { role, user } = useRouteContext({ from: '/_authenticated' });
  const save = useSaveSettings();
  const list = useServerFn(getCalendarList);
  const calendars = useQuery({ queryKey: ['calendars'], queryFn: () => list(), staleTime: 60_000 });
  const queued = useQueueSize();
  const attention = useAttentionRows();
  const [permission, setPermission] = useState('default');
  useEffect(() => {
    const update = () => setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
    update();
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, []);
  return <div className="space-y-6">
    <header className="flex items-center gap-2">
      <Button asChild variant="ghost" size="icon" aria-label="Back to Today"><Link to="/today"><ChevronLeft aria-hidden /></Link></Button>
      <h1 className="text-2xl font-semibold">Settings</h1>
    </header>
    <div className="space-y-3">
      <InstallTempo permanent slim />
      {attention.length > 0 && <Button asChild variant="ghost" className="h-auto min-h-12 w-full justify-start whitespace-normal border border-gold/40 bg-gold/10 text-gold-text">
        <Link to="/settings/data"><AlertTriangle aria-hidden /><span className="min-w-0 flex-1 text-left text-sm">{attention.length} {attention.length === 1 ? 'entry needs' : 'entries need'} attention</span><ChevronRight aria-hidden /></Link>
      </Button>}
    </div>
    {!s ? <ScreenSkeleton rows={3} header={false} /> : <>
      <MenuGroup title="Your work">
        <MenuRow icon={CalendarClock} title="Your day" summary={daySummary(s)} to="/settings/day" />
        <MenuRow icon={Timer} title="Focus" summary={focusSummary(s)} to="/settings/focus" />
        <MenuRow icon={Wind} title="Breathing" summary={breathingSummary(s)} to="/settings/breathing" />
        <MenuRow icon={CalendarDays} title="Google Calendar" summary={calendarSummary(s, calendars.data?.status, calendars.isError)} to="/settings/calendar" />
      </MenuGroup>
      <MenuGroup title="App">
        <MenuRow icon={Bell} title="Notifications" summary={notificationSummary(s, permission)} to="/settings/notifications" />
        <div className="px-4 py-3">
          <div className="mb-2 flex min-h-8 items-center gap-3"><Palette aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground" /><span className="text-sm font-semibold">Appearance</span></div>
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
            {(['system', 'dark', 'light'] as const).map(theme => <Button key={theme} role="radio" aria-checked={s.theme === theme} variant={s.theme === theme ? 'default' : 'ghost'} className="min-h-12 min-w-0 px-2 text-sm" onClick={() => save.mutate({ theme })}>{theme.charAt(0).toUpperCase() + theme.slice(1)}</Button>)}
          </div>
        </div>
      </MenuGroup>
      <MenuGroup title="You">
        <MenuRow icon={UserRound} title="Account" summary={user.email ?? 'Signed in'} to="/settings/account" />
        <MenuRow icon={Database} title="Your data" summary={dataSummary(queued)} to="/settings/data" />
        <MenuRow icon={Info} title="About" summary={`Tempo ${APP_VERSION}`} to="/settings/about" />
        {role === 'owner' && <MenuRow icon={ShieldCheck} title="Access" summary="Invites and members" to="/access" />}
      </MenuGroup>
    </>}
  </div>;
}