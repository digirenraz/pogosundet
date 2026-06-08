'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { RaidMessageRow } from './message-helpers';

interface Options {
  userId: string | null | undefined;
}

// Live total of unread raid-chat messages across every raid the current user
// has JOINED — drives the Raids tab badge (BottomNav + DesktopSidebar) and
// feeds into UnreadProvider's grand `total` (app-icon badge). Mirrors
// useDMUnread: a mount-fetch derives the true total from the DB (consumers
// remount on navigation, so in-memory state alone would reset/drift), then a
// live subscription increments it as new messages arrive.
//
// Postgres Realtime can't filter "raid_id IN (raids I've joined)" server-side
// — unlike DMs, which filter on `recipient_id`. So we subscribe to ALL
// raid_messages INSERTs globally and lazily resolve membership: the first
// time we see a message for a not-yet-known raid_id, a one-off
// `raid_attendees` lookup decides whether to count it, and the answer is
// cached so we never re-query the same raid twice. Joining a raid mid-session
// self-corrects the same way — the next message for it resolves membership
// fresh.
//
// Topic suffixed with Math.random() per the collision-avoidance rule.
export function useRaidUnread({ userId }: Options): {
  total: number;
  clearRaid: (raidId: string) => void;
} {
  const [total, setTotal] = useState(0);
  // Tracks the per-raid unread we know about so clearRaid can be precise.
  const perRaidRef = useRef<Map<string, number>>(new Map());
  // Caches "am I an attendee of this raid?" so live INSERTs resolve membership
  // at most once per raid.
  const membershipRef = useRef<Map<string, boolean>>(new Map());
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Mount-fetch the real per-raid unread counts, scoped to joined raids.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();

      const { data: attendeeRows } = await supabase
        .from('raid_attendees')
        .select('raid_id')
        .eq('user_id', userId)
        .limit(500);
      const raidIds = Array.from(
        new Set((attendeeRows ?? []).map((r: { raid_id: string }) => r.raid_id))
      );
      if (raidIds.length === 0) {
        if (!cancelled) {
          perRaidRef.current = new Map();
          membershipRef.current = new Map();
          setTotal(0);
        }
        return;
      }
      for (const raidId of raidIds) membershipRef.current.set(raidId, true);

      // A missing raid_reads row means the raid's chat was never opened —
      // every message from someone else counts as unread.
      const { data: reads } = await supabase
        .from('raid_reads')
        .select('raid_id, last_read_at')
        .eq('user_id', userId);
      const readsByRaid = new Map<string, string>();
      for (const r of (reads ?? []) as Array<{ raid_id: string; last_read_at: string }>) {
        readsByRaid.set(r.raid_id, r.last_read_at);
      }

      const counts = await Promise.all(
        raidIds.map(async (raidId) => {
          let q = supabase
            .from('raid_messages')
            .select('*', { count: 'exact', head: true })
            .eq('raid_id', raidId)
            .neq('user_id', userId);
          const since = readsByRaid.get(raidId);
          if (since) q = q.gt('created_at', since);
          const { count } = await q;
          return [raidId, count ?? 0] as const;
        })
      );
      if (cancelled) return;

      const map = new Map<string, number>();
      let t = 0;
      for (const [raidId, n] of counts) {
        if (n > 0) map.set(raidId, n);
        t += n;
      }
      perRaidRef.current = map;
      setTotal(t);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Live increments — one global subscription (Realtime can't filter "raids
  // I've joined" server-side), with lazy per-raid membership resolution.
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const topic = `raid-unread-${Math.random().toString(36).slice(2, 10)}`;

    const bump = (raidId: string) => {
      if (pathnameRef.current?.endsWith(`/raids/${raidId}`)) return;
      perRaidRef.current.set(raidId, (perRaidRef.current.get(raidId) ?? 0) + 1);
      setTotal((t) => t + 1);
    };

    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'raid_messages' },
        (payload) => {
          const row = payload.new as RaidMessageRow;
          if (row.user_id === userId) return;

          const known = membershipRef.current.get(row.raid_id);
          if (known === false) return;
          if (known === true) {
            bump(row.raid_id);
            return;
          }

          // First sighting of this raid — resolve membership once, cache it,
          // then count if joined. Fire-and-forget: a missed bump here just
          // means the next message for this raid retries the resolution.
          (async () => {
            const { data } = await supabase
              .from('raid_attendees')
              .select('user_id')
              .eq('raid_id', row.raid_id)
              .eq('user_id', userId)
              .maybeSingle();
            const isMember = !!data;
            membershipRef.current.set(row.raid_id, isMember);
            if (isMember) bump(row.raid_id);
          })();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const clearRaid = useCallback((raidId: string) => {
    const prior = perRaidRef.current.get(raidId) ?? 0;
    if (prior === 0) return;
    perRaidRef.current.delete(raidId);
    setTotal((t) => Math.max(0, t - prior));
  }, []);

  return { total, clearRaid };
}
