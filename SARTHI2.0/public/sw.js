// SARTHI service worker — enables (a) installable/offline-capable PWA shell
// and (b) real Web Push notifications that arrive even when the app tab is
// closed (unlike the in-tab Notification API used in demo mode).

const CACHE = "sarthi-shell-v1";
const SHELL_URLS = ["/", "/index.html", "/sarthi-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first for navigation so referral data is always fresh when online;
// falls back to the cached shell when offline (rural PHC connectivity gaps).
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/index.html")));
  }
});

// Real push — triggered server-side by the send-push Edge Function whenever
// a referral event matters to this user (see supabase/functions/send-push).
self.addEventListener("push", (event) => {
  let payload = { title: "SARTHI", body: "You have a referral update." };
  try {
    payload = event.data.json();
  } catch {
    /* non-JSON payload — use defaults */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "SARTHI", {
      body: payload.body,
      icon: "/sarthi-icon.svg",
      badge: "/sarthi-icon.svg",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.openWindow(url));
});
