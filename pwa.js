// Registers the service worker so the browser considers this an
// installable app ("Add to Home Screen" / desktop install icon).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
