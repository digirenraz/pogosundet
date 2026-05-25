'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { DirectMessageRow } from './helpers';

interface Options {
  userId: string | null | undefined;
  // Optional server-rendered seed. When omitted (the BottomNav path) the real
  // total is fetched on mount.
  initialTotal?: number;
}

// Live total of unread DMs across all conversations — drives the BottomNav
// badge. Each INSERT for a row where the current user is recipient bumps the
// counter, unless the user is already viewing that conversation page (the
// server-side mark-as-read on render handles that).
//
// BottomNav is rendered per-page, so it REMOUNTS on every navigation. The
// mount-fetch below re-derives the true unread total from the DB each time —
// without it the badge would reset to 0 and clear as soon as you leave /chat,
// even though the DMs are still unread (they were never opened). Mirrors
// useChannelUnread's mount-fetch path; replicates the server-only
// getUnreadCountsForUser over RLS (the user can read their own DMs + dm_reads).
//
// Topic suffix is random per the 2026-05-19 collision rule. Path-aware
// suppression mirrors useChannelUnread.
export function useDMUnread({ userId, initialTotal }: Options): {
  total: number;
  clearPartner: (partnerId: string) => void;
} {
  const [total, setTotal] = useState<number>(initialTotal ?? 0);
  // Tracks the per-partner unread we know about so clearPartner can be precise.
  const perPartnerRef = useRef<Map<string, number>>(new Map());
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Mount-fetch the real per-partner unread counts (skipped when a server seed
  // is supplied).
  useEffect(() => {
    if (!userId || initialTotal !== undefined) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();

      // Distinct partners who have sent us at least one DM.
      const { data: senders } = await supabase
        .from('direct_messages')
        .select('sender_id')
        .eq('recipient_id', userId)
        .limit(500);
      const partnerIds = Array.from(
        new Set((senders ?? []).map((r: { sender_id: string }) => r.sender_id))
      );
      if (partnerIds.length === 0) {
        if (!cancelled) {
          perPartnerRef.current = new Map();
          setTotal(0);
        }
        return;
      }

      // A missing dm_reads row means the conversation was never opened — every
      // message from that partner counts as unread.
      const { data: reads } = await supabase
        .from('dm_reads')
        .select('partner_id, last_read_at')
        .eq('user_id', userId);
      const readsByPartner = new Map<string, string>();
      for (const r of (reads ?? []) as Array<{
        partner_id: string;
        last_read_at: string;
      }>) {
        readsByPartner.set(r.partner_id, r.last_read_at);
      }

      const counts = await Promise.all(
        partnerIds.map(async (partnerId) => {
          let q = supabase
            .from('direct_messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', partnerId)
            .eq('recipient_id', userId);
          const since = readsByPartner.get(partnerId);
          if (since) q = q.gt('created_at', since);
          const { count } = await q;
          return [partnerId, count ?? 0] as const;
        })
      );
      if (cancelled) return;

      const map = new Map<string, number>();
      let t = 0;
      for (const [partnerId, n] of counts) {
        if (n > 0) map.set(partnerId, n);
        t += n;
      }
      perPartnerRef.current = map;
      setTotal(t);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, initialTotal]);

  // Live increments.
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const topic = `dm-unread-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as DirectMessageRow;
          // Skip if we're already on the matching DM page.
          if (pathnameRef.current?.endsWith(`/chat/dm/${row.sender_id}`)) return;
          perPartnerRef.current.set(
            row.sender_id,
            (perPartnerRef.current.get(row.sender_id) ?? 0) + 1
          );
          setTotal((t) => t + 1);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const clearPartner = useCallback((partnerId: string) => {
    const prior = perPartnerRef.current.get(partnerId) ?? 0;
    if (prior === 0) return;
    perPartnerRef.current.delete(partnerId);
    setTotal((t) => Math.max(0, t - prior));
  }, []);

  return { total, clearPartner };
}
