// Service worker for PoGoSundet PWA.
//
// Strategy:
//   - /_next/static/*  → cache-first (content-hashed, immutable)
//   - manifest / icon / fonts → cache-first
//   - HTML navigations → stale-while-revalidate (paint instantly, update in background)
//   - Everything else (Supabase, dynamic APIs) → network only
//
// Why: the previous network-first policy meant every reopen waited for the network
// before painting, which made the installed PWA feel as slow as a normal browser tab.
// SWR serves the cached shell instantly while a fresh copy is fetched in the background.

const SHELL_CACHE = 'pogosundet-shell-v2';
const RUNTIME_CACHE = 'pogosundet-runtime-v2';

// URLs precached on install. /login is a safe entry point for cold reopens —
// the server still re-checks auth on every navigation, so showing the cached
// login shell for an unauthenticated user is harmless.
const PRECACHE = ['/login', '/manifest.json', '/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => clients.claim())
  );
});

function cacheFirst(request) {
  return caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
      }
      return response;
    });
  });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(cached => {
    const networkPromise = fetch(request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
      }
      return response;
    }).catch(() => cached);
    return cached || networkPromise;
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only handle same-origin requests. Supabase / Google fonts / extensions pass through.
  if (url.origin !== self.location.origin) return;

  // Hashed static assets — content-hashed by Next.js, safe to cache forever.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // PWA assets.
  if (url.pathname === '/manifest.json' || url.pathname === '/icon.svg' || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // HTML navigations — SWR so reopens paint instantly.
  if (event.request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Everything else falls through to default network behaviour.
});

// Handle incoming push notifications.
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

// Open the relevant raid when the user taps the notification.
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
