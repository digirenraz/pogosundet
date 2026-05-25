'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { dmTypingTopic } from './pair-key';

const TYPING_IDLE_MS = 3000;

// Chat-list-scoped DM typing tracker. For each partner the current user has a
// conversation with, subscribes to that pair's stable typing topic
// (`dmTypingTopic(me, partner)`) so the `/chat` DM rows can show "skriver…"
// without the DM thread being open. The DM counterpart to
// use-channel-list-typing.ts (which is keyed by channel id instead of partner).
//
// Returns the set of partner ids currently typing; entries auto-expire after 3s.
export function useDMListTyping(
  currentUserId: string | null,
  partnerIds: string[]
): Set<string> {
  const [typing, setTyping] = useState<Set<string>>(new Set());
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable, order-independent key so the subscription effect only re-runs when
  // the *set* of partners changes — not on every DM-list re-sort.
  const partnerKey = useMemo(
    () => [...partnerIds].sort().join(','),
    [partnerIds]
  );

  useEffect(() => {
    if (!currentUserId || !partnerKey) return;
    const ids = partnerKey.split(',');
    const supabase = createClient();

    function recompute() {
      const now = Date.now();
      const next = new Set<string>();
      for (const [partnerId, lastAt] of lastSeenRef.current.entries()) {
        if (now - lastAt < TYPING_IDLE_MS) next.add(partnerId);
        else lastSeenRef.current.delete(partnerId);
      }
      setTyping(next);
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
      if (lastSeenRef.current.size > 0) {
        expireTimerRef.current = setTimeout(recompute, TYPING_IDLE_MS);
      }
    }

    const channels = ids.map((partnerId) =>
      supabase
        .channel(dmTypingTopic(currentUserId, partnerId))
        .on('broadcast', { event: 'typing' }, (payload) => {
          const userId = (payload.payload as { user_id?: string } | undefined)
            ?.user_id;
          // Only the partner shares this topic; ignore our own echo.
          if (!userId || userId === currentUserId) return;
          lastSeenRef.current.set(partnerId, Date.now());
          recompute();
        })
        .subscribe()
    );

    return () => {
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
      for (const ch of channels) supabase.removeChannel(ch);
    };
  }, [currentUserId, partnerKey]);

  return typing;
}
