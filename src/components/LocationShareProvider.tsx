'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { refreshShare, startShare, stopShare } from '@/lib/location/helpers';
import { shouldRefreshPosition } from '@/lib/location/staleness';
import { SHARE_GEO_OPTIONS } from '@/lib/location/types';
import { useGeolocation } from '@/lib/hooks/use-geolocation';

// Owns the current user's own location share, app-wide.
//
// Mounted ONCE in the [locale] layout, next to UnreadProvider, and that
// placement is the whole point rather than an implementation detail. A web app
// cannot read location in the background — navigator.geolocation is a window
// API, so nothing we wake from a service worker can refresh a position, and
// iOS freezes a backgrounded PWA within seconds. The only moments we can
// update someone's pin are the moments they have the app in front of them.
//
// So we refresh on *every* foreground, on every screen: opening the app to read
// chat or post a raid moves your pin as a side effect. Living on the map screen
// alone would mean a pin only updated when its owner happened to look at the
// map, which is exactly when it matters least.
//
// It also renders the persistent "du deler din position" banner. That banner is
// the primary safety affordance of this feature: it must be visible everywhere
// and must not be dismissible, so that nobody can forget they are sharing.
interface LocationShareContextValue {
  /** Expiry of the active share (ISO), or null when not sharing. */
  expiresAt: string | null;
  isSharing: boolean;
  start: (minutes: number, note?: string | null) => Promise<void>;
  stop: () => Promise<void>;
  /** Set once the current user is resolved; null while logged out. */
  userId: string | null;
}

const LocationShareContext = createContext<LocationShareContextValue | null>(null);

export function LocationShareProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const { refresh } = useGeolocation(SHARE_GEO_OPTIONS);

  // Timestamp of the last successful position write, for the refresh throttle.
  const lastWriteRef = useRef<number | null>(null);
  // Mirrors `expiresAt` so the visibility listener can read it without being
  // re-registered on every tick of the countdown.
  const expiresRef = useRef<string | null>(null);
  useEffect(() => {
    expiresRef.current = expiresAt;
  }, [expiresAt]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getClaims();
      if (!cancelled) setUserId(data?.claims?.sub ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore an in-flight share after a reload or a cold open — the row outlives
  // the tab, so the banner has to come back with it.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('live_locations')
        .select('expires_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled || !data?.expires_at) return;
      if (new Date(data.expires_at).getTime() > Date.now()) {
        setExpiresAt(data.expires_at as string);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Clear local state the moment the window closes, without waiting for a
  // server round trip — the banner must never outlive the share it describes.
  useEffect(() => {
    if (!expiresAt) return;
    // Floored at 0 rather than cleared inline: an already-expired timestamp
    // still has to clear on a timer, because setState directly in an effect
    // body triggers a cascading render (react-hooks/set-state-in-effect).
    const ms = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const timer = setTimeout(() => setExpiresAt(null), ms);
    return () => clearTimeout(timer);
  }, [expiresAt]);

  // Refresh-on-foreground. Throttled so a phone flipping between apps doesn't
  // hammer the database for movement nobody can see.
  useEffect(() => {
    if (!expiresAt) return;

    const maybeRefresh = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!expiresRef.current) return;
      if (new Date(expiresRef.current).getTime() <= Date.now()) return;
      if (!shouldRefreshPosition(lastWriteRef.current, Date.now())) return;

      const position = await refresh();
      if (!position) return;
      try {
        const stillActive = await refreshShare(position.lat, position.lng);
        lastWriteRef.current = Date.now();
        // The share expired server-side while we were reading the GPS.
        if (!stillActive) setExpiresAt(null);
      } catch {
        // Transient failure (offline, flaky mobile data) — the next foreground
        // tries again. Nothing to show the user; their pin just ages, which the
        // "set X min siden" label already communicates honestly.
      }
    };

    document.addEventListener('visibilitychange', maybeRefresh);
    window.addEventListener('focus', maybeRefresh);
    void maybeRefresh();

    return () => {
      document.removeEventListener('visibilitychange', maybeRefresh);
      window.removeEventListener('focus', maybeRefresh);
    };
  }, [expiresAt, refresh]);

  const start = useCallback(
    async (minutes: number, note?: string | null) => {
      const position = await refresh();
      if (!position) throw new Error('no_position');
      const expiry = await startShare({
        lat: position.lat,
        lng: position.lng,
        minutes,
        note: note ?? null,
      });
      lastWriteRef.current = Date.now();
      setExpiresAt(expiry);
    },
    [refresh]
  );

  const stop = useCallback(async () => {
    if (!userId) return;
    // Clear locally first: stopping must feel instant and must not appear to
    // have failed if the network is slow.
    setExpiresAt(null);
    lastWriteRef.current = null;
    await stopShare(userId);
  }, [userId]);

  return (
    <LocationShareContext.Provider
      value={{ expiresAt, isSharing: expiresAt !== null, start, stop, userId }}
    >
      {children}
    </LocationShareContext.Provider>
  );
}

export function useLocationShare(): LocationShareContextValue {
  const ctx = useContext(LocationShareContext);
  if (!ctx) {
    throw new Error('useLocationShare must be used within LocationShareProvider');
  }
  return ctx;
}
