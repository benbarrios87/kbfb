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
