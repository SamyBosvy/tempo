import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScreenSkeleton } from '@/components/tempo/bits';
import { useSettings, type Settings } from '@/lib/settings';

export function SettingsSubpage({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-7">
    <header className="flex items-center gap-2">
      <Button asChild variant="ghost" size="icon" aria-label="Back to Settings"><Link to="/settings"><ChevronLeft aria-hidden /></Link></Button>
      <h1 className="min-w-0 text-2xl font-semibold">{title}</h1>
    </header>
    {children}
  </div>;
}

export function SettingsControls({ section: Section }: { section: React.ComponentType<{ s: Settings }> }) {
  const { data } = useSettings();
  return data ? <Section s={data} /> : <ScreenSkeleton header={false} rows={3} />;
}

export function settingsHead(title: string, description: string) {
  return { meta: [
    { title: `${title} · Tempo settings` },
    { name: 'description', content: description },
    { property: 'og:title', content: `${title} · Tempo settings` },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex, nofollow' },
  ] };
}