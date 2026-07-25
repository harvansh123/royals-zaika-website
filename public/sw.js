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
    body:     payload.body  || "You have a new notification",
    icon:     payload.icon  || "/icons/icon-192x192.png",
    badge:    "/icons/icon-72x72.png",
    sound:    "/order_incoming_ringtone_loud_extended.mp3",
    tag:      payload.tag   || "royalzaika-notification",
    renotify: true,
    vibrate:  [300, 100, 300, 100, 300, 100, 300],
    data: {
      url:     payload.url || "/",
      type:    payload.type || "general",
    },
    actions: payload.actions || [],
  };

  event.waitUntil(
    (async () => {
      // Show system notification
      await self.registration.showNotification(title, options);

      // ── Try to wake up any open app tab to play custom alarm ──
      // If the user has the app open in any tab (even background),
      // send a message to trigger the custom alarm sound there.
      const allClients = await clients.matchAll({
        type:             "window",
        includeUncontrolled: true,
      });

      if (allClients.length > 0) {
        // App is open somewhere — send message to play custom alarm
        for (const client of allClients) {
          client.postMessage({
            type:    "PUSH_ALARM",
            payload: payload,
          });
        }
      }
    })()
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
