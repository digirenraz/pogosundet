// Service worker for PoGoSundet PWA.
// Slice 8 will extend this to handle push notification events.
const CACHE = 'pogosundet-v1';
const PRECACHE = ['/manifest.json', '/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => clients.claim())
  );
});

// Network-first: always try the network, fall back to cache for GET requests.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Handle incoming push notifications (Slice 8)
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Nyt raid!', {
      body: data.body ?? '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: data.url ?? '/raids' },
    })
  );
});

// Open the relevant raid when the user taps the notification
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/raids';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
