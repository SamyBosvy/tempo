import { createFileRoute } from '@tanstack/react-router';
import { PrivacySection } from '@/components/tempo/settings/sections';
import { SettingsSubpage, settingsHead } from '@/components/tempo/settings/page';

export const Route = createFileRoute('/_authenticated/settings/data')({
  head: () => settingsHead('Your data', 'Private data, offline entries, exports and account deletion.'),
  component: PrivacySectionPage,
});

function PrivacySectionPage() {
  return <SettingsSubpage title="Your data"><PrivacySection /></SettingsSubpage>;
}
