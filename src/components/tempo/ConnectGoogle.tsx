import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { startGoogleConnect } from "@/lib/google.functions";
import { Button } from "@/components/ui/button";
import { GOOGLE_RETURN_KEY, googleReturnPath, navigateToGoogle } from "@/lib/google-connect";

export function ConnectGoogleButton({ label, size }: { label: string; size?: "sm" | "default" }) {
  const start = useServerFn(startGoogleConnect);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const returnPath = googleReturnPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      try {
        sessionStorage.setItem(GOOGLE_RETURN_KEY, returnPath);
      } catch {
        // Signed state also retains the return path when storage is unavailable.
      }
      const { url } = await start({ data: { origin: window.location.origin, returnPath } });
      navigateToGoogle(url, window);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start the connection. Try again.");
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
