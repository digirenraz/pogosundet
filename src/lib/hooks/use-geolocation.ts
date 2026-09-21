'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GymLocation } from '@/lib/gyms/maps';

// Browser geolocation, shared by the nearby-gym suggestions (raid form) and
// live location sharing.
//
// GDPR: for the gym suggestions the position is used transiently in the browser
// to sort suggestions by distance — it is NEVER stored and NEVER sent to our
// servers (Privacy Policy §9). Live location sharing is the deliberate
// exception: there the user explicitly chooses to publish their position for a
// bounded window, and only via an affirmative action. Either way the permission
// prompt only ever appears on an explicit user action (`request()`, wired to a
// visible button); on mount we read the position silently ONLY when the browser
// permission is already granted, so returning users skip the button without
// being prompted.
//
// Status flow:
//   'unsupported'      — no navigator.geolocation (nothing renders)
//   'idle'             — permission not yet granted: show the request button
//   'granted-pending'  — position being fetched (transient)
//   'located'          — position available
//   'denied'           — permission denied or lookup failed (nothing renders;
//                        re-grants go through the browser's own permission UI)
export type GeolocationStatus =
  | 'unsupported'
  | 'idle'
  | 'granted-pending'
  | 'located'
  | 'denied';

// Defaults tuned for gym-suggestion sorting: a cached, low-accuracy fix is
// plenty to rank stops a few hundred metres apart, and it is much faster and
// cheaper on battery. Location sharing overrides these (see SHARE_GEO_OPTIONS
// in src/lib/location/types.ts) because there the precision is the point.
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 60_000,
  timeout: 10_000,
};

/**
 * One-shot position read, outside React.
 *
 * Exists so callers that must ONLY read a position on an explicit user action
 * can do so without mounting the hook — the hook reads silently on mount when
 * the browser permission is already granted, which is right for gym sorting
 * (the user is on the raid form) but wrong for anything mounted app-wide.
 *
 * Resolves to null on denial, timeout, or an unsupported browser.
 */
export function readPosition(options?: PositionOptions): Promise<GymLocation | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      options ?? GEO_OPTIONS
    );
  });
}

export function useGeolocation(options?: PositionOptions): {
  status: GeolocationStatus;
  position: GymLocation | null;
  request: () => void;
  /** Re-read the position without changing status back to pending. */
  refresh: () => Promise<GymLocation | null>;
} {
  // Lazy initializer instead of a "did mount" setState (React 19 lint rule).
  // During SSR navigator is undefined → 'unsupported'; nothing depending on
  // the status is rendered before user interaction, so hydration is safe.
  const [status, setStatus] = useState<GeolocationStatus>(() =>
    typeof navigator === 'undefined' || !navigator.geolocation
      ? 'unsupported'
      : 'idle'
  );
  const [position, setPosition] = useState<GymLocation | null>(null);

  // Held in a ref so callers can pass an inline options object without
  // re-creating locate() (and re-running the mount effect) on every render.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Guards against setState after unmount from the async geolocation
  // callbacks (both the silent mount path and request()).
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const locate = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (cancelledRef.current) return;
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('located');
      },
      () => {
        if (cancelledRef.current) return;
        setStatus('denied');
      },
      optionsRef.current ?? GEO_OPTIONS
    );
  }, []);

  // On mount: if the permission is already granted, fetch the position
  // silently (no prompt); if denied, reflect that. Browsers without the
  // Permissions API (or a 'prompt' state) stay 'idle' so the visible button
  // triggers the actual prompt.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const permissions = navigator.permissions;
    if (!permissions?.query) return;

    permissions
      .query({ name: 'geolocation' })
      .then(result => {
        if (cancelledRef.current) return;
        if (result.state === 'granted') {
          setStatus('granted-pending');
          locate();
        } else if (result.state === 'denied') {
          setStatus('denied');
        }
        // 'prompt' → stay 'idle'.
      })
      .catch(() => {
        // Permissions query failed → stay 'idle'; the button still works.
      });
  }, [locate]);

  // Explicit user action (the "Vis gyms i nærheden" button, or starting a
  // location share) — may show the browser's permission prompt.
  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }
    setStatus('granted-pending');
    locate();
  }, [locate]);

  // One-shot read that resolves with the position, for callers that need the
  // value inline rather than as rendered state — the refresh-on-focus path
  // writes the new position immediately and has nothing to render meanwhile,
  // so it must not flip the status back to 'granted-pending' and flicker the UI.
  const refresh = useCallback((): Promise<GymLocation | null> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.resolve(null);
    }
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (!cancelledRef.current) {
            setPosition(next);
            setStatus('located');
          }
          resolve(next);
        },
        () => resolve(null),
        optionsRef.current ?? GEO_OPTIONS
      );
    });
  }, []);

  return { status, position, request, refresh };
}
