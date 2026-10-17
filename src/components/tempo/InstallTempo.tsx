import { Download, X } from 'lucide-react';
import { useInstall } from '@/lib/install';
import { installVisible } from '@/lib/install-rules';
import { Button } from '@/components/ui/button';
import { Card } from './bits';
import { toast } from 'sonner';
export function InstallTempo({ permanent = false }: { permanent?: boolean }) {
  const i = useInstall();
  if (!installVisible(i.installed, i.dismissed, i.available, permanent)) return null;
  const contents = <><div className="flex items-start justify-between gap-2"><p className="text-sm">{permanent ? 'Install Tempo' : 'Add Tempo to your home screen for reminders and a full-screen app.'}</p>{!permanent && <Button variant="ghost" size="icon" className="shrink-0" aria-label="Dismiss install card" onClick={i.dismiss}><X/></Button>}</div>{i.ios ? <p className="text-sm text-muted-foreground">Share → Add to Home Screen</p> : <Button variant="outline" className="w-full" onClick={() => { void i.install().catch(() => toast.error("Couldn't open installation. Try again.")); }}><Download/>{permanent ? 'Install Tempo' : 'Install'}</Button>}</>;
  return permanent ? <div className="space-y-3">{contents}</div> : <Card className="space-y-3">{contents}</Card>;
}
