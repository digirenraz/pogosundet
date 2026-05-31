'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RaidReactionRow } from './raid-reaction-helpers';

interface ReactionCallbacks {
  onInsert: (row: RaidReactionRow) => void;
  onDelete: (row: RaidReactionRow) => void;
}

// Subscribes to INSERT/DELETE events on raid_reactions for a single raid.
// raid_reactions HAS a raid_id column, so we filter server-side at the
// PostgREST layer — only this raid's events arrive.
//
// Callbacks are stored in a ref so the subscription effect only re-runs on
// raidId / currentUserId changes — keeps the WS connection stable.
//
// IMPORTANT: the topic name uses a Math.random() suffix to avoid the channel
// collision documented in the decisions log on 2026-05-19 (multiple
// subscribers on the same topic name fail with "cannot add postgres_changes
// callbacks after subscribe()"). Do NOT use useId() — colons break Supabase
// topic parsing.
export function useRaidReactionRealtime(
  raidId: string,
  currentUserId: string | null,
  callbacks: ReactionCallbacks
): void {
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();
    const topic = `raid:raid-reactions:${raidId}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(topic);

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'raid_reactions',
          filter: `raid_id=eq.${raidId}`,
        },
        (payload) => {
          callbacksRef.current.onInsert(payload.new as RaidReactionRow);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'raid_reactions',
          filter: `raid_id=eq.${raidId}`,
        },
        (payload) => {
          // DELETE payloads use `old` for the prior row state.
          callbacksRef.current.onDelete(payload.old as RaidReactionRow);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [raidId, currentUserId]);
}
