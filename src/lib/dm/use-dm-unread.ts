'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { DirectMessageRow } from './helpers';

interface Options {
  userId: string | null | undefined;
  initialTotal?: number;
}

// Live total of unread DMs across all conversations — drives the BottomNav
// badge. Each INSERT for a row where the current user is recipient bumps the
// counter, unless the user is already viewing that conversation page (the
// server-side mark-as-read on render handles that).
//
// Topic suffix is random per the 2026-05-19 collision rule. Path-aware
// suppression mirrors useChannelUnread.
export function useDMUnread({ userId, initialTotal = 0 }: Options): {
  total: number;
  clearPartner: (partnerId: string) => void;
} {
  const [total, setTotal] = useState<number>(initialTotal);
  // Tracks the per-partner unread we know about so clearPartner can be precise.
  const perPartnerRef = useRef<Map<string, number>>(new Map());
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    setTotal(initialTotal);
  }, [initialTotal]);

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
