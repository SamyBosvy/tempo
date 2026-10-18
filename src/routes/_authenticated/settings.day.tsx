import { createFileRoute } from '@tanstack/react-router';
import { DaySection } from '@/components/tempo/settings/sections';
import { SettingsSubpage, settingsHead, SettingsControls } from '@/components/tempo/settings/page';

export const Route = createFileRoute('/_authenticated/settings/day')({
  head: () => settingsHead('Your day', 'Working hours and the buffer after meetings.'),
  component: DaySectionPage,
});

function DaySectionPage() {
  return <SettingsSubpage title="Your day"><SettingsControls section={DaySection} /></SettingsSubpage>;
}
