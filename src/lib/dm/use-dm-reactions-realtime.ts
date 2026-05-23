'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DMReactionRow } from './reactions-helpers';

interface ReactionCallbacks {
  onInsert: (row: DMReactionRow) => void;
  onDelete: (row: DMReactionRow) => void;
}

// Subscribes to INSERT/DELETE on direct_message_reactions. The reactions table
// has no conversation column to filter on at PostgREST level — RLS already
// scopes visibility to participants, and we additionally filter client-side
// against the live `messageIdSet` so events for messages outside the open
// conversation are dropped.
//
// Topic uses a Math.random() suffix to dodge the 2026-05-19 collision rule.
export function useDMReactionsRealtime(
  currentUserId: string | null,
  partnerId: string | null,
  messageIdSet: Set<string>,
  callbacks: ReactionCallbacks
): void {
  const messageIdSetRef = useRef(messageIdSet);
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    messageIdSetRef.current = messageIdSet;
  }, [messageIdSet]);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!currentUserId || !partnerId) return;
    const supabase = createClient();
    const topic = `dm:reactions:${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(topic);

    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_message_reactions' },
        (payload) => {
          const row = payload.new as DMReactionRow;
          if (!messageIdSetRef.current.has(row.message_id)) return;
          callbacksRef.current.onInsert(row);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'direct_message_reactions' },
        (payload) => {
          const row = payload.old as DMReactionRow;
          if (!messageIdSetRef.current.has(row.message_id)) return;
          callbacksRef.current.onDelete(row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, partnerId]);
}
