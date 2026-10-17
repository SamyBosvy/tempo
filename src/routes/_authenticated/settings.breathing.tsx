import { createFileRoute } from '@tanstack/react-router';
import { BreathSection } from '@/components/tempo/settings/sections';
import { SettingsSubpage, settingsHead, SettingsControls } from '@/components/tempo/settings/page';

export const Route = createFileRoute('/_authenticated/settings/breathing')({
  head: () => settingsHead('Breathing', 'Breathing patterns, length and Prime lead time.'),
  component: BreathSectionPage,
});

function BreathSectionPage() {
  return <SettingsSubpage title="Breathing"><SettingsControls section={BreathSection} /></SettingsSubpage>;
}
