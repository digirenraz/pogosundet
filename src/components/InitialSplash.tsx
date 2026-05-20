'use client';

import { useEffect, useState } from 'react';
import { useMounted } from '@/lib/hooks/use-mounted';

// First-paint splash wrapper. Renders its children (typically <LoadingScreen />)
// in the SSR HTML so they show instantly on cold start, then fades and unmounts
// after React hydrates. Mounted in `[locale]/layout.tsx`; since layouts persist
// across client-side navigation, this only fires on a true cold app open.
export function InitialSplash({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => setRemoved(true), 250);
    return () => clearTimeout(t);
  }, [mounted]);

  if (removed) return null;

  return (
    <div
      aria-hidden={mounted}
      style={{
        opacity: mounted ? 0 : 1,
        transition: 'opacity 200ms ease-out',
        pointerEvents: mounted ? 'none' : 'auto',
      }}
    >
      {children}
    </div>
  );
}
