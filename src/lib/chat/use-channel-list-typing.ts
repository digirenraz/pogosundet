'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CHANNELS, type ChannelId } from './channels';

const TYPING_IDLE_MS = 3000;

type TypingState = Record<ChannelId, Set<string>>;

const EMPTY: TypingState = { generelt: new Set(), feedback: new Set() };

// Channel-list-scoped typing tracker. Subscribes to broadcast 'typing'
// events on both `chat:generelt` and `chat:feedback` so the channel-list
// rows can show "X skriver…" even when the user isn't viewing that channel.
// Mirrors the per-channel pattern in use-channel-realtime.ts but folded into
// one hook keyed by channel id.
export function useChannelListTyping(currentUserId: string | null | undefined): TypingState {
  const [typing, setTyping] = useState<TypingState>(EMPTY);
  const lastSeenRef = useRef<Map<ChannelId, Map<string, number>>>(new Map());
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();

    function recompute() {
      const now = Date.now();
      const next: TypingState = { generelt: new Set(), feedback: new Set() };
      let anyActive = false;
      for (const c of CHANNELS) {
        const seen = lastSeenRef.current.get(c.id);
        if (!seen) continue;
        for (const [userId, lastAt] of seen.entries()) {
          if (now - lastAt < TYPING_IDLE_MS) {
            next[c.id].add(userId);
            anyActive = true;
          } else {
            seen.delete(userId);
          }
        }
      }
      setTyping(next);
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
      if (anyActive) {
        expireTimerRef.current = setTimeout(recompute, TYPING_IDLE_MS);
      }
    }

    const channels = CHANNELS.map((c) =>
      supabase
        .channel(`chat:${c.id}`)
        .on('broadcast', { event: 'typing' }, (payload) => {
          const userId = (payload.payload as { user_id?: string } | undefined)?.user_id;
          if (!userId || userId === currentUserId) return;
          let m = lastSeenRef.current.get(c.id);
          if (!m) {
            m = new Map();
            lastSeenRef.current.set(c.id, m);
          }
          m.set(userId, Date.now());
          recompute();
        })
        .subscribe()
    );

    return () => {
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
      for (const ch of channels) supabase.removeChannel(ch);
    };
  }, [currentUserId]);

  return typing;
}
