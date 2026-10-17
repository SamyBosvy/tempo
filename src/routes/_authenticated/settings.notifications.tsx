import { createFileRoute } from '@tanstack/react-router';
import { NotificationSection } from '@/components/tempo/settings/sections';
import { SettingsSubpage, settingsHead, SettingsControls } from '@/components/tempo/settings/page';

export const Route = createFileRoute('/_authenticated/settings/notifications')({
  head: () => settingsHead('Notifications', 'Reminder permissions, delivery and sounds.'),
  component: NotificationSectionPage,
});

function NotificationSectionPage() {
  return <SettingsSubpage title="Notifications"><SettingsControls section={NotificationSection} /></SettingsSubpage>;
}
