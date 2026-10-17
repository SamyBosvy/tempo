import { createFileRoute } from '@tanstack/react-router';
import { AccountSection } from '@/components/tempo/settings/sections';
import { SettingsSubpage, settingsHead } from '@/components/tempo/settings/page';

export const Route = createFileRoute('/_authenticated/settings/account')({
  head: () => settingsHead('Account', 'Email, account security and sign out.'),
  component: AccountSectionPage,
});

function AccountSectionPage() {
  return <SettingsSubpage title="Account"><AccountSection /></SettingsSubpage>;
}
