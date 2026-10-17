// Notifications go through the service worker (Android Chrome rejects the
// Notification constructor). Without a worker (dev, editor preview) we fall
// back to the constructor where the browser allows it, and never throw.
export type NotifyOptions = { body: string; tag: string; url: string };

export type NotifyPermission = NotificationPermission | "unsupported";

export function permissionLabel(p: NotifyPermission): string {
  if (p === "granted") return "Allowed";
  if (p === "denied") return "Blocked";
  if (p === "default") return "Not asked";
  return "Not supported";
}

export async function showAppNotification(title: string, o: NotifyOptions): Promise<boolean> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return false;
  if (Notification.permission !== "granted") return false;
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg?.active) {
      await reg.showNotification(title, { body: o.body, tag: o.tag, icon: "/icon-192.png", data: { url: o.url } });
      return true;
    }
  } catch {
    // fall through to the fallback
  }
  try {
    const n = new window.Notification(title, { body: o.body, tag: o.tag, icon: "/icon-192.png" });
    n.onclick = () => {
      window.focus();
      window.location.assign(o.url);
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

export function primeUrl(eventId: string, startIso: string) {
  return `/prime?${new URLSearchParams({ event: eventId, at: startIso, auto: "1" }).toString()}`;
}
