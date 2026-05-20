'use client';

import { useEffect, useState } from 'react';
import { useMounted } from '@/lib/hooks/use-mounted';

// Keep the splash visible for at least this long from navigation start. On
// snappy connections hydration finishes well under this, so we hold the splash
// for the remainder before fading. On slow phones the load itself covers it
// and no artificial wait is added.
const MIN_VISIBLE_MS = 800;
const FADE_MS = 200;

// First-paint splash wrapper. Renders its children (typically <LoadingScreen />)
// in the SSR HTML so they show instantly on cold start, then fades and unmounts
// after React hydrates. Mounted in `[locale]/layout.tsx`; since layouts persist
// across client-side navigation, this only fires on a true cold app open.
export function InitialSplash({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const [dismissing, setDismissing] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    const remaining = Math.max(0, MIN_VISIBLE_MS - performance.now());
    const fade = setTimeout(() => setDismissing(true), remaining);
    const remove = setTimeout(() => setRemoved(true), remaining + FADE_MS + 50);
    return () => {
      clearTimeout(fade);
      clearTimeout(remove);
    };
  }, [mounted]);

  if (removed) return null;

  return (
    <div
      aria-hidden={dismissing}
      style={{
        opacity: dismissing ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        pointerEvents: dismissing ? 'none' : 'auto',
      }}
    >
      {children}
    </div>
  );
}
