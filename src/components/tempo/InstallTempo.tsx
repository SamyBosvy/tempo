import { ChevronRight, Download, X } from 'lucide-react';
import { useState } from 'react';
import { useInstall } from '@/lib/install';
import { INSTALL_STEPS, installVisible } from '@/lib/install-rules';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet';
import { Card } from './bits';
import { toast } from 'sonner';
export function InstallTempo({ permanent = false, slim = false }: { permanent?: boolean; slim?: boolean }) {
  const i = useInstall();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!installVisible(i.installed, i.dismissed, i.available, permanent)) return null;
  async function download() {
    if (busy) return;
    setBusy(true);
    try { if (!await i.install()) setOpen(true); }
    catch { toast.error("Couldn't open installation. Use the browser menu instead."); setOpen(true); }
    finally { setBusy(false); }
  }
   const contents = <>{!permanent && <div className="flex items-start justify-between gap-2"><p className="text-sm">Add Tempo to your home screen for reminders and a full-screen app.</p><Button variant="ghost" size="icon" className="shrink-0" aria-label="Dismiss install card" onClick={i.dismiss}><X/></Button></div>}<Button type="button" variant="outline" className={slim ? "min-h-12 w-full justify-start border-subtle bg-card px-4 text-sm" : "min-h-12 w-full whitespace-normal"} disabled={busy} onClick={() => void download()}><Download aria-hidden/><span className={slim ? "min-w-0 flex-1 text-left" : ""}>Download the app</span>{slim && <ChevronRight aria-hidden className="text-muted-foreground" />}</Button></>;
  return <>{permanent ? <div>{contents}</div> : <Card className="space-y-3">{contents}</Card>}<Sheet open={open} onOpenChange={setOpen}><SheetContent side="bottom" className="mx-auto flex max-h-[90dvh] max-w-lg flex-col gap-0 overflow-hidden p-0 [&>button]:hidden"><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5"><SheetHeader className="text-left"><SheetTitle>Download Tempo</SheetTitle><SheetDescription>Install on this device</SheetDescription></SheetHeader><ol className="mt-5 list-decimal space-y-3 pl-5 text-sm">{INSTALL_STEPS[i.platform].map(step => <li key={step}>{step}</li>)}</ol></div><footer className="shrink-0 border-t border-subtle bg-background px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)]"><SheetClose asChild><Button className="min-h-12 w-full whitespace-normal">Done</Button></SheetClose></footer></SheetContent></Sheet></>;
}
