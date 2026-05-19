'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CHANNELS, type ChannelId } from './channels';
import type { ChannelMessageRow } from './helpers';

export type UnreadCounts = Record<ChannelId, number>;

const ZERO: UnreadCounts = { generelt: 0, feedback: 0 };

interface Options {
  userId: string | null | undefined;
  initialCounts?: UnreadCounts | null;
}

// Live unread counts driven by channel_messages INSERTs.
// - Initial state from `initialCounts` (server-rendered) when provided,
//   otherwise fetched on mount (BottomNav uses this path).
// - Subscribes to BOTH channels so the badge updates everywhere — not just
//   on chat pages.
// - INSERT for a channel increments unless: sender is current user, OR the
//   user is currently viewing that channel's page (the page-load mark-as-read
//   will handle that case).
export function useChannelUnread({ userId, initialCounts }: Options): {
  counts: UnreadCounts;
  total: number;
  clearChannel: (channel: ChannelId) => void;
} {
  const [counts, setCounts] = useState<UnreadCounts>(initialCounts ?? ZERO);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!userId) return;
    if (initialCounts) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: reads } = await supabase
        .from('channel_reads')
        .select('channel, last_read_at')
        .eq('user_id', userId);
      const readsByChannel = new Map<ChannelId, string>();
      for (const r of (reads ?? []) as Array<{ channel: ChannelId; last_read_at: string }>) {
        readsByChannel.set(r.channel, r.last_read_at);
      }
      const results = await Promise.all(
        CHANNELS.map(async (c) => {
          let q = supabase
            .from('channel_messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel', c.id)
            .neq('user_id', userId);
          const since = readsByChannel.get(c.id);
          if (since) q = q.gt('created_at', since);
          const { count } = await q;
          return [c.id, count ?? 0] as const;
        })
      );
      if (cancelled) return;
      setCounts(Object.fromEntries(results) as UnreadCounts);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, initialCounts]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    // Fresh per-mount topic name avoids collisions with any concurrent
    // hook instance (e.g. BottomNav + ChannelListScreen on /chat) and with
    // React Strict Mode's mount → cleanup → remount cycle in dev.
    const topic = `chat-unread-${Math.random().toString(36).slice(2, 10)}`;
    const channelIds = new Set<ChannelId>(CHANNELS.map((c) => c.id));
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'channel_messages' },
        (payload) => {
          const row = payload.new as ChannelMessageRow;
          if (!channelIds.has(row.channel)) return;
          if (row.user_id === userId) return;
          if (pathnameRef.current?.endsWith(`/chat/${row.channel}`)) return;
          setCounts((prev) => ({ ...prev, [row.channel]: prev[row.channel] + 1 }));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const clearChannel = useCallback((channel: ChannelId) => {
    setCounts((prev) => (prev[channel] === 0 ? prev : { ...prev, [channel]: 0 }));
  }, []);

  const total = counts.generelt + counts.feedback;
  return { counts, total, clearChannel };
}
