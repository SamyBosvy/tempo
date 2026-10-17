import { createFileRoute } from '@tanstack/react-router';
import { SAFETY_TEXT } from '@/components/tempo/bits';
import { SyncSection } from '@/components/tempo/settings/sections';
import { SettingsSubpage, settingsHead } from '@/components/tempo/settings/page';

export const Route = createFileRoute('/_authenticated/settings/about')({
  head: () => settingsHead('About', 'Tempo safety information, version and sync status.'),
  component: AboutPage,
});

function AboutPage() {
  return <SettingsSubpage title="About">
    <section aria-label="Safety" className="space-y-4">{SAFETY_TEXT.map(p => <p key={p} className="text-sm leading-relaxed text-muted-foreground">{p}</p>)}</section>
    <SyncSection />
  </SettingsSubpage>;
}
