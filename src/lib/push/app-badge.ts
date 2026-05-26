// App-icon unread badge helpers (Badging API + shared count store).
//
// Two concerns live here:
//   1. setBadge / clearBadge — thin, no-throw wrappers around the web Badging
//      API (navigator.setAppBadge / clearAppBadge). Available on installed PWAs
//      (iOS 16.4+, desktop Chrome/Edge, Android as a dot). MUST never throw on
//      unsupported browsers — every call is feature-detected.
//   2. A tiny promisified IndexedDB store (DB `pogosundet`, object store `meta`,
//      key `badgeCount`) so the client and the service worker share one number.
//      The SW inlines the equivalent logic (a classic SW cannot import ES
//      modules); keep the two in sync if either changes.

const DB_NAME = 'pogosundet';
const STORE_NAME = 'meta';
const BADGE_KEY = 'badgeCount';

// --- Badging API ------------------------------------------------------------

// Set the home-screen icon badge to `n`. Clamps negatives to 0 and clears the
// badge entirely when the count is 0 (matching native messaging behaviour).
// No-ops silently when the Badging API is unavailable.
export async function setBadge(n: number): Promise<void> {
  const count = Math.max(0, Math.floor(n));
  if (count === 0) {
    await clearBadge();
    return;
  }
  if (typeof navigator === 'undefined' || typeof navigator.setAppBadge !== 'function') {
    return;
  }
  try {
    await navigator.setAppBadge(count);
  } catch {
    // Some platforms expose the method but reject (e.g. permission state) —
    // never let badge updates surface as runtime errors.
  }
}

// Clear the home-screen icon badge. No-ops when unsupported.
export async function clearBadge(): Promise<void> {
  if (typeof navigator === 'undefined' || typeof navigator.clearAppBadge !== 'function') {
    return;
  }
  try {
    await navigator.clearAppBadge();
  } catch {
    // Ignore — see setBadge.
  }
}

// --- Shared count store (IndexedDB) -----------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Read the persisted badge count. Returns 0 when unset or on any failure.
export async function readBadgeCount(): Promise<number> {
  try {
    const db = await openDb();
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(BADGE_KEY);
      req.onsuccess = () => {
        const value = req.result;
        resolve(typeof value === 'number' ? value : 0);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return 0;
  }
}

// Persist the badge count so the service worker can increment from truth.
export async function writeBadgeCount(n: number): Promise<void> {
  const count = Math.max(0, Math.floor(n));
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(count, BADGE_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Best-effort; the client recomputes the true total on next open anyway.
  }
}
