// MATKA11 Service Worker - SELF-DESTRUCT MODE
// This version exists ONLY to clean up old broken service workers.
// It unregisters itself and clears all caches, then the app runs WITHOUT a service worker.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Delete every cache
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {}
    // Unregister self
    try {
      await self.registration.unregister();
    } catch (_) {}
    // Force all open tabs to reload (so they pick up a no-SW app)
    try {
      const clientList = await self.clients.matchAll({ type: 'window' });
      for (const client of clientList) {
        client.navigate(client.url);
      }
    } catch (_) {}
  })());
});

// Pass-through fetch handler — do NOT intercept anything
self.addEventListener('fetch', () => {});
