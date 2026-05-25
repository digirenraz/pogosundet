'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DirectMessageRow } from './helpers';
import { dmTypingTopic, pairKey } from './pair-key';

const TYPING_IDLE_MS = 3000;

// Subscribes to Supabase Realtime for one DM conversation.
// - INSERT events on direct_messages where the current user is the recipient
//   AND the row's sender is the open partner → onMessageInsert.
//   (Self-sent rows reconcile via the local optimistic state, same pattern as
//   channel chat — no need to listen for our own inserts.)
// - broadcast 'typing' events → typingUserIds set (auto-expires after 3s).
// Returns broadcastTyping() to call from the composer (throttled ≤ once/2s).
export function useDMRealtime(
  currentUserId: string | null,
  partnerId: string | null,
  onMessageInsert?: (row: DirectMessageRow) => void
): {
  typingUserIds: Set<string>;
  broadcastTyping: () => void;
} {
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMessageInsertRef = useRef(onMessageInsert);
  useEffect(() => {
    onMessageInsertRef.current = onMessageInsert;
  }, [onMessageInsert]);

  const broadcastFnRef = useRef<() => void>(() => {});
  const lastBroadcastRef = useRef<number>(0);

  useEffect(() => {
    if (!currentUserId || !partnerId) return;
    const supabase = createClient();

    // Message channel — postgres_changes only. Random suffix dodges the
    // 2026-05-19 multi-subscriber collision; the topic name is irrelevant for
    // postgres_changes delivery (it's replication-based).
    const messageTopic = `dm:${pairKey(currentUserId, partnerId)}:${Math.random()
      .toString(36)
      .slice(2)}`;
    const messageChannel = supabase.channel(messageTopic);

    // Typing channel — broadcast only, on a STABLE shared topic. Broadcast
    // events only reach clients on the identical topic string, so both
    // participants must compute the same name (they can't share the random
    // message topic). Broadcast-only ⇒ no postgres_changes ⇒ immune to the
    // collision rule even if mounted twice.
    const typingChannel = supabase.channel(
      dmTypingTopic(currentUserId, partnerId)
    );

    function recomputeTyping() {
      const now = Date.now();
      const next = new Set<string>();
      for (const [userId, lastAt] of lastSeenRef.current.entries()) {
        if (now - lastAt < TYPING_IDLE_MS) next.add(userId);
        else lastSeenRef.current.delete(userId);
      }
      setTypingUserIds(next);

      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
      if (lastSeenRef.current.size > 0) {
        expireTimerRef.current = setTimeout(recomputeTyping, TYPING_IDLE_MS);
      }
    }

    messageChannel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          // PostgREST filter — server side. We listen for messages addressed
          // to us; sender filter is applied client-side because PostgREST
          // realtime filters only support a single column equality.
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new as DirectMessageRow;
          if (row.sender_id !== partnerId) return;
          if (onMessageInsertRef.current) onMessageInsertRef.current(row);
        }
      )
      .subscribe();

    typingChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const userId = (payload.payload as { user_id?: string } | undefined)?.user_id;
        if (!userId || userId === currentUserId) return;
        lastSeenRef.current.set(userId, Date.now());
        recomputeTyping();
      })
      .subscribe();

    broadcastFnRef.current = () => {
      if (!currentUserId) return;
      const now = Date.now();
      if (now - lastBroadcastRef.current < 2000) return;
      lastBroadcastRef.current = now;
      typingChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: currentUserId },
      });
    };

    return () => {
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [currentUserId, partnerId]);

  return {
    typingUserIds,
    broadcastTyping: () => broadcastFnRef.current(),
  };
}
