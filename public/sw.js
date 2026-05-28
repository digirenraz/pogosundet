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

const SHELL_CACHE = 'pogosundet-shell-v11';
const RUNTIME_CACHE = 'pogosundet-runtime-v11';

// URLs precached on install. /login is a safe entry point for cold reopens —
// the server still re-checks auth on every navigation, so showing the cached
// login shell for an unauthenticated user is harmless.
const PRECACHE = ['/login', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

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
  if (url.pathname === '/manifest.json' || url.pathname === '/apple-touch-icon.png' || url.pathname.startsWith('/icon-') || url.pathname.startsWith('/icons/')) {
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

// --- Shared badge-count store (IndexedDB) -----------------------------------
//
// A classic service worker cannot import ES modules, so this duplicates the
// minimal logic from src/lib/push/app-badge.ts. DB `pogosundet`, store `meta`,
// key `badgeCount` — keep both in sync if either changes. Kept tiny so the IDB
// work completes inside `event.waitUntil` before the SW is killed.
const IDB_NAME = 'pogosundet';
const IDB_STORE = 'meta';
const IDB_BADGE_KEY = 'badgeCount';

function openBadgeDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readBadgeCount() {
  return openBadgeDb()
    .then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_BADGE_KEY);
      req.onsuccess = () => resolve(typeof req.result === 'number' ? req.result : 0);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    }))
    .catch(() => 0);
}

function writeBadgeCount(n) {
  const count = Math.max(0, Math.floor(n));
  return openBadgeDb()
    .then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(count, IDB_BADGE_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    }))
    .catch(() => {});
}

// Handle incoming push notifications.
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    (async () => {
      // DM pushes bump the home-screen icon badge while the app is closed.
      // The client recomputes the true total on next open, so any drift here
      // self-corrects. Raids are transient — they never touch the badge.
      if (data.type === 'dm') {
        const count = (await readBadgeCount()) + 1;
        await writeBadgeCount(count);
        if (typeof self.navigator !== 'undefined' && typeof self.navigator.setAppBadge === 'function') {
          await self.navigator.setAppBadge(count).catch(() => {});
        }
      }
      await self.registration.showNotification(data.title ?? 'Nyt raid!', {
        body: data.body ?? '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: data.url ?? '/raids' },
      });
    })()
  );
});

// Open the target URL when the user taps the notification.
// If a PWA window is already open we navigate it to the URL and focus it;
// otherwise we open a fresh window at the URL. The previous code only called
// focus() on the existing client, which refocused whatever screen the user
// was last on instead of the conversation/raid from the push.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/raids';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windowClients => {
      const existing = windowClients.find(c => 'focus' in c);
      if (existing) {
        try {
          const navigated = await existing.navigate(url);
          if (navigated && 'focus' in navigated) return navigated.focus();
        } catch {
          // navigate() throws on cross-origin or detached clients — fall through to focus().
        }
        return existing.focus();
      }
      return clients.openWindow(url);
    })
  );
});
