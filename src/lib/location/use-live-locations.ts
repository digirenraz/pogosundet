'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchLiveLocations } from './helpers';
import type { LiveLocation } from './types';

// Live list of everyone currently sharing a position.
//
// Reads through the get_live_locations() RPC (which purges expired rows first),
// then keeps the list fresh with postgres_changes on live_locations.
//
// Two wrinkles worth knowing:
//
// 1. Realtime payloads carry the raw row, with no profile join — so an INSERT
//    for someone not already in the list has no trainer_name to render. Rather
//    than render a nameless pin we re-read through the RPC on any event we
//    can't apply locally. At this community's size that is a handful of tiny
//    queries an hour, and it keeps the join in exactly one place.
// 2. DELETE payloads carry only the primary key (Postgres does not ship the
//    full OLD row unless REPLICA IDENTITY FULL is set), which is all we need to
//    drop a pin — so those are applied directly.
//
// Topic carries a Math.random() suffix per the convention documented in the
// 2026-05-19 decisions-log entry: two subscribers sharing a topic name fail
// with "cannot add postgres_changes callbacks after subscribe()".
export function useLiveLocations(enabled: boolean): {
  locations: LiveLocation[];
  loading: boolean;
  reload: () => Promise<void>;
} {
  const [locations, setLocations] = useState<LiveLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const rows = await fetchLiveLocations();
    setLocations(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      const rows = await fetchLiveLocations();
      if (!cancelled) {
        setLocations(rows);
        setLoading(false);
      }
    };
    void load();

    const supabase = createClient();
    const topic = `live-locations:${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(topic);

    channel
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'live_locations' },
        payload => {
          const userId = (payload.old as { user_id?: string })?.user_id;
          if (!userId || cancelled) return;
          setLocations(prev => prev.filter(l => l.user_id !== userId));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_locations' },
        () => {
          // New sharer — needs the profile join, so re-read.
          if (!cancelled) void load();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_locations' },
        payload => {
          if (cancelled) return;
          const row = payload.new as Partial<LiveLocation> & { user_id?: string };
          if (!row?.user_id) return;
          // Someone already on screen moved: patch the position in place,
          // keeping the profile fields we already resolved.
          setLocations(prev => {
            const known = prev.some(l => l.user_id === row.user_id);
            if (!known) {
              void load();
              return prev;
            }
            return prev.map(l =>
              l.user_id === row.user_id
                ? {
                    ...l,
                    lat: row.lat ?? l.lat,
                    lng: row.lng ?? l.lng,
                    note: row.note ?? l.note,
                    updated_at: row.updated_at ?? l.updated_at,
                    expires_at: row.expires_at ?? l.expires_at,
                  }
                : l
            );
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [enabled]);

  return { locations, loading, reload };
}
