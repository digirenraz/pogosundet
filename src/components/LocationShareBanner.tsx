'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Radio } from 'lucide-react';
import { useLocationShare } from '@/components/LocationShareProvider';
import { minutesRemaining } from '@/lib/location/staleness';

// Persistent "you are sharing your location" banner.
//
// This is the primary safety affordance of the location feature, which is why
// it lives in the layout rather than on the map screen and has no dismiss
// control: someone who forgot they started a share is exactly the person it
// exists for. It sits above the bottom nav so it survives every navigation.
export function LocationShareBanner() {
  const t = useTranslations('LiveLocation');
  const { isSharing, expiresAt, stop } = useLocationShare();
  const [remaining, setRemaining] = useState(0);

  // Tick once a minute — the countdown only ever shows whole minutes, so a
  // faster interval would just burn renders.
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => setRemaining(minutesRemaining(expiresAt, new Date()));
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!isSharing) return null;

  return (
    <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-20 px-4 pb-2 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md bg-[#E8F7F5] border border-[#2BBFAA] rounded-xl px-3 py-2 flex items-center gap-3 shadow-sm">
        <Radio size={18} className="text-[#2BBFAA] shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#111827] leading-tight">
            {t('sharingBanner')}
          </p>
          <p className="text-xs text-[#6B7280]">{t('remaining', { minutes: remaining })}</p>
        </div>
        <button
          type="button"
          onClick={() => void stop()}
          className="text-sm font-semibold text-[#2BBFAA] border border-[#2BBFAA] rounded-lg px-3 py-1 shrink-0"
        >
          {t('stop')}
        </button>
      </div>
    </div>
  );
}
