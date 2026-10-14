import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { startGoogleConnect } from "@/lib/google.functions";
import { Button } from "@/components/ui/button";

export function ConnectGoogleButton({ label, size }: { label: string; size?: "sm" | "default" }) {
  const start = useServerFn(startGoogleConnect);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function go() {
    // Open the popup during the tap so it isn't blocked, then point it at Google.
    const popup = window.open("", "tempo-google", "width=520,height=680");
    setBusy(true);
    try {
      const { url } = await start();
      if (!popup) {
        window.location.href = url;
        return;
      }
      popup.location.href = url;
      const ok = await new Promise<boolean>((resolve) => {
        const onMsg = (e: MessageEvent) => {
          if (e.origin !== window.location.origin || e.data?.type !== "tempo-google") return;
          cleanup();
          resolve(!!e.data.ok);
        };
        const poll = window.setInterval(() => {
          if (popup.closed) {
            cleanup();
            resolve(false);
          }
        }, 600);
        const cleanup = () => {
          window.removeEventListener("message", onMsg);
          window.clearInterval(poll);
        };
        window.addEventListener("message", onMsg);
      });
      await qc.invalidateQueries();
      if (ok) toast.success(label.startsWith("Re") ? "Calendar reconnected." : "Calendar connected.");
      else toast.error("Calendar not connected. Try again.");
    } catch {
      popup?.close();
      toast.error("Couldn't start the connection. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size={size} onClick={go} disabled={busy} className={size === "sm" ? "" : "w-full"}>
      {busy ? "Connecting…" : label}
    </Button>
  );
}
