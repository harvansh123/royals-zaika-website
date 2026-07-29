// Royal Zaika — Service Worker
// Handles: Push Notifications + Offline Caching (PWA App Shell)

const APP_NAME    = "Royal Zaika";
const CACHE_NAME  = "royalzaika-v2";
const OFFLINE_URL = "/";

// ── Assets to pre-cache on install (app shell) ──────────────────────────────
const PRECACHE_ASSETS = [
  "/",
  "/menu",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// ── Install: pre-cache app shell ────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {
        // If any pre-cache fails, still install — don't block
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => clients.claim())
  );
});

// ── Fetch: smart caching strategy ───────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin, and API requests (always go to network for these)
  if (
    request.method !== "GET" ||
    !url.origin.includes(self.location.origin) ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/")
  ) {
    return; // Let browser handle normally
  }

  // Static assets (_next/static, icons, images) → Cache First
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|avif|ico|mp3|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages → Network First, fall back to cache, then offline page
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached || caches.match(OFFLINE_URL)
          )
        )
    );
    return;
  }
});

// ── Push Event (existing — unchanged) ───────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: APP_NAME, body: event.data.text(), url: "/" };
  }

  const title = payload.title || APP_NAME;
  const options = {
    body:     payload.body  || "You have a new notification",
    icon:     payload.icon  || "/icons/icon-192.png",
    badge:    "/icons/icon-192.png",
    sound:    "/order_incoming_ringtone_loud_extended.mp3",
    tag:      payload.tag   || "royalzaika-notification",
    renotify: true,
    vibrate:  [300, 100, 300, 100, 300, 100, 300],
    data: {
      url:  payload.url  || "/",
      type: payload.type || "general",
    },
    actions: payload.actions || [],
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);

      // Wake up any open app tab to play custom alarm
      const allClients = await clients.matchAll({
        type:                "window",
        includeUncontrolled: true,
      });

      if (allClients.length > 0) {
        for (const client of allClients) {
          client.postMessage({ type: "PUSH_ALARM", payload });
        }
      }
    })()
  );
});

// ── Notification Click (existing — unchanged) ────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
