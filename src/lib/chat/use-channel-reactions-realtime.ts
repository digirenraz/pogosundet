'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ChannelId } from './channels';
import type { ChannelReactionRow } from './reactions-helpers';

interface ReactionCallbacks {
  onInsert: (row: ChannelReactionRow) => void;
  onDelete: (row: ChannelReactionRow) => void;
}

// Subscribes to INSERT/DELETE events on channel_message_reactions. Because the
// reactions table has no `channel` column (and no FK to filter on at the
// PostgREST layer), we subscribe to ALL events and filter client-side using
// the `messageIdSet` passed in.
//
// IMPORTANT: messageIdSet and callbacks are stored in refs so the subscription
// effect only re-runs on channelId / currentUserId changes — keeps the WS
// connection stable as new messages arrive.
//
// Topic uses a Math.random() suffix to avoid the channel-name collision
// documented in the decisions log on 2026-05-19 (multiple subscribers on the
// same topic name fail with "cannot add postgres_changes callbacks after
// subscribe()").
export function useChannelReactionsRealtime(
  channelId: ChannelId,
  currentUserId: string | null,
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
    if (!currentUserId) return;
    const supabase = createClient();
    const topic = `chat:reactions:${channelId}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(topic);

    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'channel_message_reactions' },
        (payload) => {
          const row = payload.new as ChannelReactionRow;
          if (!messageIdSetRef.current.has(row.message_id)) return;
          callbacksRef.current.onInsert(row);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'channel_message_reactions' },
        (payload) => {
          // DELETE payloads use `old` for the prior row state.
          const row = payload.old as ChannelReactionRow;
          if (!messageIdSetRef.current.has(row.message_id)) return;
          callbacksRef.current.onDelete(row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, currentUserId]);
}
