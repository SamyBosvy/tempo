import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GOOGLE_FAILURES, GOOGLE_RETURN_KEY, googleReturnPath } from "@/lib/google-connect";

export function GoogleConnectResult() {
  const qc = useQueryClient();
  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("google");
    if (status !== "connected" && status !== "failed") return;
    const reason = url.searchParams.get("google_error");
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(GOOGLE_RETURN_KEY);
      sessionStorage.removeItem(GOOGLE_RETURN_KEY);
    } catch {
      // The signed return path works in a new tab without shared sessionStorage.
    }
    url.searchParams.delete("google");
    url.searchParams.delete("google_error");
    // Consume the result once so reloads/navigation never repeat the toast.
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    if (status === "connected") {
      toast.success("Calendar connected.");
      void Promise.all([
        qc.invalidateQueries({ queryKey: ["settings"] }),
        qc.invalidateQueries({ queryKey: ["calendars"] }),
        qc.invalidateQueries({ queryKey: ["gcal"] }),
      ]);
    } else {
      const message = reason && Object.hasOwn(GOOGLE_FAILURES, reason)
        ? GOOGLE_FAILURES[reason as keyof typeof GOOGLE_FAILURES]
        : "Calendar not connected. Try again.";
      toast.error(message);
    }
    if (stored && url.pathname === "/settings" && googleReturnPath(stored).startsWith("/today")) {
      window.location.replace(googleReturnPath(stored));
    }
  }, [qc]);
  return null;
}