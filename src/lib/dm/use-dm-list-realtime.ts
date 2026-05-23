'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DirectMessageRow } from './helpers';

// Snapshot of the most recently observed message per partner. Drives the
// DM list ordering + last-message preview live.
export type LatestByPartner = Record<
  string,
  { body: string; created_at: string; sender_id: string } | null
>;

interface Options {
  userId: string | null | undefined;
}

// Subscribes to ALL direct_messages INSERTs where the current user is the
// recipient. Sender-side rows arrive via the local optimistic state on the DM
// page itself — but the channel-list view doesn't need a re-render for the
// sender's own message because the SSR fetch already reflects it on next
// navigation.
//
// Topic uses a Math.random() suffix to dodge the 2026-05-19 collision rule.
export function useDMListRealtime({ userId }: Options): {
  latestByPartner: LatestByPartner;
  onInsertCallback: (cb: (row: DirectMessageRow) => void) => void;
} {
  const [latestByPartner, setLatestByPartner] = useState<LatestByPartner>({});
  const externalCbRef = useRef<((row: DirectMessageRow) => void) | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const topic = `dm-list-${Math.random().toString(36).slice(2, 10)}`;
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
          setLatestByPartner((prev) => ({
            ...prev,
            [row.sender_id]: {
              body: row.body,
              created_at: row.created_at,
              sender_id: row.sender_id,
            },
          }));
          externalCbRef.current?.(row);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  function onInsertCallback(cb: (row: DirectMessageRow) => void) {
    externalCbRef.current = cb;
  }

  return { latestByPartner, onInsertCallback };
}
