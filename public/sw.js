// Royal Zaika - Service Worker for Web Push Notifications
// Handles background push events when the app tab is closed or inactive.

const APP_NAME = "Royal Zaika";

// ── Push Event ──────────────────────────────────────────────────────────
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
    body:    payload.body  || "You have a new notification",
    icon:    payload.icon  || "/icons/icon-192x192.png",
    badge:   "/icons/icon-72x72.png",
    tag:     payload.tag   || "royalzaika-notification",
    renotify: true,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: payload.url || "/",
    },
    actions: payload.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification Click ──────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Install & Activate ─────────────────────────────────────────────────
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
