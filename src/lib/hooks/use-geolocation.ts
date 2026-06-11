'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GymLocation } from '@/lib/gyms/maps';

// Browser geolocation for the nearby-gym suggestions (raid form).
//
// GDPR: the position is used transiently in the browser to sort gym
// suggestions by distance — it is NEVER stored and NEVER sent to our servers
// (Privacy Policy §9). The permission prompt only ever appears on an explicit
// user action (`request()`, wired to a visible button); on mount we read the
// position silently ONLY when the browser permission is already granted, so
// returning users skip the button without being prompted.
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

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 60_000,
  timeout: 10_000,
};

export function useGeolocation(): {
  status: GeolocationStatus;
  position: GymLocation | null;
  request: () => void;
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
      GEO_OPTIONS
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

  // Explicit user action (the "Vis gyms i nærheden" button) — may show the
  // browser's permission prompt.
  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }
    setStatus('granted-pending');
    locate();
  }, [locate]);

  return { status, position, request };
}
