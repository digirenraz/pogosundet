'use client';

import { useEffect } from 'react';

// Registers the service worker on first load. No-op on browsers that don't
// support it (or when running in development without HTTPS).
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
