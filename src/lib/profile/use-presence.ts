'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Tracks who is currently online via a shared Supabase Realtime presence channel.
// Each client joins under its own user id and receives sync/join/leave events.
// Returns a Set of user_ids currently subscribed; auto-cleans on unmount.
//
// Pattern reference: src/lib/raids/use-raids-realtime.ts.
export function usePresence(userId: string | null | undefined): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase.channel('players-online', {
      config: { presence: { key: userId } },
    });

    const recompute = () => {
      const state = channel.presenceState() as Record<string, Array<{ user_id?: string }>>;
      const next = new Set<string>();
      for (const [key, metas] of Object.entries(state)) {
        next.add(key);
        for (const meta of metas) {
          if (meta?.user_id) next.add(meta.user_id);
        }
      }
      setOnline(next);
    };

    channel
      .on('presence', { event: 'sync' }, recompute)
      .on('presence', { event: 'join' }, recompute)
      .on('presence', { event: 'leave' }, recompute)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId });
          // Fire-and-forget: keep last_seen_at reasonably fresh. No await/error
          // handling needed — best-effort, runs on every authenticated page load.
          void supabase
            .from('profiles')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('user_id', userId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return online;
}
