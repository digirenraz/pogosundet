'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { RaidMessageRow } from './message-helpers';

// Subscribes to Supabase Realtime on raid tables and re-runs the server
// component (router.refresh) when changes arrive — gives near-instant
// updates without polling. Debounced 250ms to coalesce bursts.
//
// - no raidId → overview mode (all raids/attendees/messages)
// - raidId + onMessageInsert → detail mode: attendee changes still trigger
//   router.refresh (needs the profile join), but message INSERTs call
//   onMessageInsert instead — avoids a full RSC refetch for every chat message.
//
// onMessageInsert is stored in a ref so the subscription effect never
// re-runs when the callback changes identity between renders.
//
// Requires Replication enabled on raids/raid_attendees/raid_messages
// (migration 005_realtime.sql, applied manually in the Supabase SQL editor).
export function useRaidsRealtime(
  raidId?: string,
  onMessageInsert?: (row: RaidMessageRow) => void
) {
  const router = useRouter();
  const onMessageInsertRef = useRef(onMessageInsert);
  onMessageInsertRef.current = onMessageInsert;

  useEffect(() => {
    const supabase = createClient();
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const refresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => router.refresh(), 250);
    };

    const channel = supabase.channel(raidId ? `raid:${raidId}` : 'raids:overview');

    if (raidId) {
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'raid_attendees', filter: `raid_id=eq.${raidId}` },
          refresh
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'raid_messages', filter: `raid_id=eq.${raidId}` },
          (payload) => {
            if (onMessageInsertRef.current) {
              onMessageInsertRef.current(payload.new as RaidMessageRow);
            } else {
              refresh();
            }
          }
        );
    } else {
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'raids' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'raid_attendees' }, refresh)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'raid_messages' }, refresh);
    }

    channel.subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [raidId, router]);
}
