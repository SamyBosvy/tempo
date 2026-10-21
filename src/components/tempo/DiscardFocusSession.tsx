import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { focusTimer } from "@/lib/focus-timer";
import { tapHaptic } from "@/lib/haptics";
import { toast } from "sonner";

export function DiscardFocusSession({ onDiscard }: { onDiscard: () => void }) {
  const [open, setOpen] = useState(false);

  function discard() {
    tapHaptic();
    focusTimer.clear();
    setOpen(false);
    onDiscard();
    toast.success("Session discarded.");
  }

  return (
    <>
      <Button variant="ghost" className="min-h-12 w-full text-destructive" onClick={() => setOpen(true)}>
        Discard session
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm overflow-hidden">
          <DialogHeader className="min-h-0 overflow-y-auto pr-5">
            <DialogTitle>Discard this session?</DialogTitle>
            <DialogDescription>It won't be saved or counted in your focus time.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="shrink-0">
            <Button variant="ghost" onClick={() => setOpen(false)}>Keep it</Button>
            <Button variant="destructive" onClick={discard}>Discard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}