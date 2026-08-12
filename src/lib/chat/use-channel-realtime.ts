'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ChannelId } from './channels';
import type { ChannelMessageRow } from './helpers';

// Idle window after which a "typing" broadcast drops off the set.
const TYPING_IDLE_MS = 3000;

// Subscribes to Supabase Realtime for a single chat channel.
// - INSERT events on channel_messages (server-side filter) → onMessageInsert callback
// - DELETE events on channel_messages → onMessageDelete callback (moderation)
// - broadcast 'typing' events → typingUserIds set (auto-expires after 3s)
// Returns broadcastTyping() to call from the composer (throttled ≤ once/2s).
//
// The callbacks are stored in refs so the subscription effect doesn't
// re-run on every render — matches the pattern in use-raids-realtime.ts.
export function useChannelRealtime(
  channelId: ChannelId,
  currentUserId: string | null,
  onMessageInsert?: (row: ChannelMessageRow) => void,
  onMessageDelete?: (messageId: string) => void
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

  const onMessageDeleteRef = useRef(onMessageDelete);
  useEffect(() => {
    onMessageDeleteRef.current = onMessageDelete;
  }, [onMessageDelete]);

  const broadcastFnRef = useRef<() => void>(() => {});
  const lastBroadcastRef = useRef<number>(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`chat:${channelId}`);

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

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_messages',
          filter: `channel=eq.${channelId}`,
        },
        (payload) => {
          if (onMessageInsertRef.current) {
            onMessageInsertRef.current(payload.new as ChannelMessageRow);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'channel_messages',
          // NO filter here, unlike the INSERT above: a DELETE payload carries
          // only the primary key (default REPLICA IDENTITY), so `channel` is
          // absent and a channel filter would never match. The consumer drops
          // the id from its own list, which is inherently channel-scoped.
        },
        (payload) => {
          const id = (payload.old as { id?: string } | undefined)?.id;
          if (id && onMessageDeleteRef.current) onMessageDeleteRef.current(id);
        }
      )
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
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: currentUserId },
      });
    };

    return () => {
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [channelId, currentUserId]);

  return {
    typingUserIds,
    broadcastTyping: () => broadcastFnRef.current(),
  };
}
