// Service worker for PoGoSundet PWA.
//
// Strategy:
//   - /_next/static/*  → cache-first (content-hashed, immutable)
//   - manifest / icon / fonts → cache-first
//   - HTML navigations → network-first (fresh document; cached shell only offline)
//   - Everything else (Supabase, dynamic APIs) → network only
//
// Why network-first for navigations: HTML references the current build's hashed
// chunk filenames. Stale-while-revalidate served the PREVIOUS build's cached
// HTML instantly after a deploy, whose chunk hashes the new deploy has already
// purged (404) → ChunkLoadError → the global error boundary. Installed PWAs hit
// this on every deploy ("works after a few reopens" as the SWR revalidate caught
// up). Network-first always serves a document matching the live chunks when
// online, and falls back to the cached shell only when the network fails.

const SHELL_CACHE = 'pogosundet-shell-v15';
const RUNTIME_CACHE = 'pogosundet-runtime-v15';

// Holds an image shared into the app via the Web Share Target (Android). It is
// NOT versioned and is preserved across SW activations (see the activate
// allowlist) so a share that arrives mid-update isn't wiped before the new-raid
// form can read it. The form (src/app/[locale]/raids/new/page.tsx) reads the
// same cache name + key, then deletes the entry once consumed.
const SHARE_CACHE = 'pogosundet-share';
const SHARE_IMAGE_KEY = '/__shared-raid-image';

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
          .filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE && k !== SHARE_CACHE)
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

// Network-first: always try the network so the served document references the
// CURRENT build's chunk hashes. Cache the fresh response for an offline fallback,
// and fall back to the cached shell (then the precached /login) when the network
// fails. The server re-checks auth on every navigation, so serving a cached shell
// to a logged-out user is harmless.
function networkFirst(request) {
  return fetch(request).then(response => {
    if (response.ok) {
      const clone = response.clone();
      caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
    }
    return response;
  }).catch(() =>
    caches.match(request).then(cached => cached || caches.match('/login'))
  );
}

// Web Share Target (Android): the OS POSTs a shared image to /raids/share. We
// stash it in SHARE_CACHE and 303-redirect to the new-raid form, which reads it
// back and pre-fills the screenshot. iOS Safari doesn't support share targets,
// so this path only ever fires on Android.
function handleShareTarget(request) {
  return request.formData()
    .then(formData => {
      const image = formData.get('image');
      if (!image || typeof image === 'string') return;
      return caches.open(SHARE_CACHE).then(cache =>
        cache.put(
          SHARE_IMAGE_KEY,
          new Response(image, {
            headers: {
              'content-type': image.type || 'application/octet-stream',
              // Preserve the original filename so the form can derive an extension.
              'x-share-filename': image.name || 'screenshot.jpg',
            },
          })
        )
      );
    })
    .catch(() => {})
    // Always land on the form, even if extracting the image failed.
    .then(() => Response.redirect(new URL('/raids/new?shared=1', self.location.origin).href, 303));
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Share Target POST must be handled before the GET-only guard below.
  if (event.request.method === 'POST' && url.pathname === '/raids/share') {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  if (event.request.method !== 'GET') return;

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

  // HTML navigations — network-first so the document always matches the live
  // build's chunks (avoids post-deploy ChunkLoadError on installed PWAs).
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
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
      // Work out the foreground state and whether the user is already looking at
      // the exact conversation/raid this push is about.
      const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      const visibleClients = windowClients.filter(c => c.visibilityState === 'visible');
      const appInForeground = visibleClients.length > 0;

      const targetPath = new URL(data.url ?? '/raids', self.location.origin).pathname;
      // Require BOTH visible AND focused — mirrors src/lib/push/notification-
      // suppression.ts (`isViewingPushTarget`, unit tested), keep both in sync.
      // `visibilityState` alone is NOT a reliable "looking at it right now"
      // signal on Android Chrome: backgrounding an installed PWA (locking the
      // screen, switching apps, Home) can leave a stale `visible` WindowClient
      // behind for a while, so a DM for the conversation the user had open
      // right before backgrounding was wrongly treated as "already on screen"
      // and silently swallowed (issue #107). `focused` mirrors
      // document.hasFocus(), which the browser flips synchronously on blur.
      const viewingTarget = visibleClients.some(c => {
        if (!c.focused) return false;
        try { return new URL(c.url).pathname === targetPath; } catch { return false; }
      });

      // Suppress the notification only when the user is already on the exact
      // screen this push points to — there's nothing to alert them about. Pushes
      // for any other screen still notify, even with the app open. Suppressing
      // only a *visible and focused* target also keeps us clear of the
      // iOS/Chrome penalty for silent background pushes — that path is never silent.
      if (viewingTarget) return;

      // DM pushes bump the home-screen icon badge, but ONLY when the app is not
      // in the foreground. When it is, the in-app realtime unread badges own the
      // count, so bumping here would double-count it. Raids are transient — they
      // never touch the badge. The client recomputes the true total on next open,
      // so any drift self-corrects.
      if (data.type === 'dm' && !appInForeground) {
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
