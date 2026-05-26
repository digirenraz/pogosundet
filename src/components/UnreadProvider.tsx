'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useChannelUnread } from '@/lib/chat/use-channel-unread';
import { useDMUnread } from '@/lib/dm/use-dm-unread';
import { useMounted } from '@/lib/hooks/use-mounted';
import { setBadge, writeBadgeCount } from '@/lib/push/app-badge';
import type { ChannelId } from '@/lib/chat/channels';

// Shared unread state for the whole app.
//
// Mounted ONCE in the [locale] layout (which persists across navigation), so
// useChannelUnread + useDMUnread no longer remount/refetch on every page change
// — this is what kills the BottomNav badge flicker. BottomNav consumes this
// context instead of running the hooks itself.
//
// It also owns the home-screen icon badge: whenever the true unread total
// changes (or the app resumes from the background), it pushes that number to
// the Badging API and persists it to IndexedDB so the service worker can keep
// incrementing from truth while the app is closed.
interface UnreadContextValue {
  total: number;
  clearChannel: (channel: ChannelId) => void;
  clearPartner: (partnerId: string) => void;
}

const UnreadContext = createContext<UnreadContextValue | null>(null);

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const [userId, setUserId] = useState<string | null>(null);

  // Resolve the current user once (same path as BottomNav used to use). The
  // unread hooks no-op while userId is null, so logged-out pages that share
  // this layout (/login, /register, /) cost nothing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getClaims();
      const sub = data?.claims?.sub ?? null;
      if (!cancelled) setUserId(sub);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { total: channelUnread, clearChannel } = useChannelUnread({ userId });
  const { total: dmUnread, clearPartner } = useDMUnread({ userId });
  const total = channelUnread + dmUnread;

  // Reflect the true total onto the icon badge + the shared IndexedDB store.
  // Runs on mount, whenever the total changes, and when the app resumes from
  // the background (visibilitychange / focus) — at which point the SW may have
  // incremented the stored count while we were closed, so we re-assert truth.
  useEffect(() => {
    if (!mounted) return;
    const sync = () => {
      void setBadge(total);
      void writeBadgeCount(total);
    };
    sync();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', sync);
    };
  }, [mounted, total]);

  return (
    <UnreadContext.Provider value={{ total, clearChannel, clearPartner }}>
      {children}
    </UnreadContext.Provider>
  );
}

// Consumed by BottomNav (and any future surface needing the live unread total).
// Returns a safe zero-state when used outside the provider so it never throws.
export function useUnread(): UnreadContextValue {
  const ctx = useContext(UnreadContext);
  if (!ctx) {
    return { total: 0, clearChannel: () => {}, clearPartner: () => {} };
  }
  return ctx;
}
