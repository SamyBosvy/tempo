import { createFileRoute } from '@tanstack/react-router';
import { CalendarSection } from '@/components/tempo/settings/sections';
import { SettingsSubpage, settingsHead, SettingsControls } from '@/components/tempo/settings/page';

export const Route = createFileRoute('/_authenticated/settings/calendar')({
  head: () => settingsHead('Google Calendar', 'Read-only calendar connection and stressful-meeting keywords.'),
  component: CalendarSectionPage,
});

function CalendarSectionPage() {
  return <SettingsSubpage title="Google Calendar"><SettingsControls section={CalendarSection} /></SettingsSubpage>;
}
