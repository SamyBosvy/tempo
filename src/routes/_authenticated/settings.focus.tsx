import { createFileRoute } from '@tanstack/react-router';
import { FocusSection } from '@/components/tempo/settings/sections';
import { SettingsSubpage, settingsHead, SettingsControls } from '@/components/tempo/settings/page';

export const Route = createFileRoute('/_authenticated/settings/focus')({
  head: () => settingsHead('Focus', 'Daily focus target, session length and interruptions.'),
  component: FocusSectionPage,
});

function FocusSectionPage() {
  return <SettingsSubpage title="Focus"><SettingsControls section={FocusSection} /></SettingsSubpage>;
}
