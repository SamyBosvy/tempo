// Imported by the generated service worker: open the right screen when a notification is tapped.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "/today";
  const url = new URL(raw, self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === url.origin && "focus" in c) {
          return c.focus().then((w) => (w && "navigate" in w ? w.navigate(url.href) : undefined));
        }
      }
      return self.clients.openWindow(url.href);
    }),
  );
});

// Private push payloads contain no event titles or session intentions.
self.addEventListener("push", (event) => {
  let data;
  try { data = event.data.json(); } catch { return; }
  const allowed = ["/prime", "/focus", "/today", "/insights", "/settings"];
  let url;
  try { url = new URL(data.url, self.location.origin); } catch { return; }
  if (url.origin !== self.location.origin || !allowed.includes(url.pathname)) return;
  event.waitUntil(self.registration.showNotification(data.title || "Tempo", {
    body: data.body || "", tag: data.tag, icon: "/icon-192.png", badge: "/icon-192.png",
    data: { url: url.pathname + url.search + url.hash },
  }));
});
