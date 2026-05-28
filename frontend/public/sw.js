// MATKA11 Service Worker
// Strategy:
// - HTML / navigation: ALWAYS network (never cache, so deploy ke baad fresh bundle path mile)
// - On network failure for navigation: serve offline.html
// - API: network-only (so stale data show na ho)
// - Static assets (JS/CSS/images): cache-first with content-hash (CRA does hashing)
// - Auto-update: skipWaiting + clients.claim, message channel for SKIP_WAITING

const CACHE_NAME = 'matka11-v11';
const OFFLINE_URL = '/offline.html';

// Install: pre-cache offline page so it's available even on first run
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([OFFLINE_URL, '/manifest.json']))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches and take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Allow client to trigger immediate activation of new SW
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-http and non-GET requests
  if (!url.protocol.startsWith('http')) return;
  if (event.request.method !== 'GET') return;

  // 1) API: network-only, NO caching, NO offline JSON spoof (frontend handles errors)
  if (url.pathname.startsWith('/api')) {
    return; // let browser handle it natively
  }

  // 2) Navigation requests (HTML page loads): network-first, fallback to offline.html
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r || new Response('Offline', { status: 503 }))
      )
    );
    return;
  }

  // 3) Static assets (JS / CSS / images / fonts): cache-first
  const isStatic = /\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf)$/i.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
          }
          return response;
        }).catch(() => caches.match(OFFLINE_URL));
      })
    );
    return;
  }

  // Default: network passthrough
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// ===== Push notifications (existing) =====
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'MATKA 11', body: event.data.text() }; }
  const title = data.title || 'MATKA 11';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/dashboard' },
    vibrate: [120, 60, 120],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
