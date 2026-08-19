// Minimal pass-through service worker. Its only job is to satisfy the
// browser's "installable PWA" requirement (a fetch handler must exist) -
// this app always talks to Supabase live, so we deliberately don't cache
// or serve anything offline here.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

// Vaktbytte fase 2: real Web Push. Server (send-push-notification Edge
// Function) sends a JSON payload {title, body, url}; we just have to
// turn that into a visible notification.
self.addEventListener("push", (event) => {
  let data = { title: "KBFB", body: "", url: "dashboard.html" };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "images/icon-192.png",
      badge: "images/icon-192.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "dashboard.html";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
