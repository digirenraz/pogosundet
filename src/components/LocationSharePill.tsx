'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Radio, X } from 'lucide-react';
import { useLocationShare } from '@/components/LocationShareProvider';
import { minutesRemaining } from '@/lib/location/staleness';

// "You are sharing your location" indicator.
//
// This is the primary safety affordance of the location feature, which is why
// it lives in the layout rather than on the map screen and has no dismiss
// control: someone who forgot they started a share is exactly the person it
// exists for.
//
// It is a small right-edge pill rather than a full-width banner, borrowing the
// pattern Pokémon GO uses for an active incense — a compact countdown that
// expands to explain itself. Two reasons, in order of importance:
//
//  1. A full-width bar pinned above the bottom nav sits on top of whatever a
//     page puts at the bottom of its scroll, and a `position: fixed` overlay
//     blocks that screen band no matter how far the page scrolls. It made the
//     logout button on /profile/edit unclickable while a share was active.
//  2. Players already read a right-edge timer as "something of yours is
//     running", so the compact form needs no explaining.
//
// The collapsed pill is deliberately minimal (icon + minutes). The sentence it
// drops is not lost: it is the button's accessible name, so assistive tech
// still announces "Du deler din position" rather than a bare number.
export function LocationSharePill() {
  const t = useTranslations('LiveLocation');
  const { isSharing, expiresAt, stop } = useLocationShare();
  const [remaining, setRemaining] = useState(0);
  // Which share the panel was opened for, rather than a plain boolean. That
  // makes "close the panel when the share ends" a derived value instead of an
  // effect that resets state — React 19's set-state-in-effect rule rejects the
  // effect form, and a share can end without the user closing the panel
  // (expiry, or stopped from another device).
  const [expandedFor, setExpandedFor] = useState<string | null>(null);

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

  const expanded = expandedFor !== null && expandedFor === expiresAt;

  const label = `${t('sharingBanner')} – ${t('remaining', { minutes: remaining })}`;

  return (
    <>
      {/* Collapsed pill. Sits clear of the bottom nav (h-16) on mobile; on
          desktop there is no bottom nav, so it drops to the corner. */}
      <button
        type="button"
        onClick={() => setExpandedFor(expiresAt)}
        aria-label={label}
        aria-expanded={expanded}
        className="fixed right-4 bottom-20 lg:bottom-4 z-20 bg-[#2BBFAA] text-white rounded-full shadow-lg pl-3 pr-4 py-2 flex items-center gap-2"
      >
        <Radio size={16} aria-hidden />
        <span className="text-sm font-semibold tabular-nums">
          {t('pillRemaining', { minutes: remaining })}
        </span>
      </button>

      {/* Expanded panel — centred, matching the pattern the incense timer uses:
          tap the countdown, get told what is running and how to end it. */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
          onClick={() => setExpandedFor(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('sharingBanner')}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-md p-5 flex flex-col gap-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E8F7F5] flex items-center justify-center shrink-0">
                <Radio size={20} className="text-[#2BBFAA]" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-[#111827]">{t('sharingBanner')}</h2>
                <p className="text-sm text-[#6B7280]">{t('remaining', { minutes: remaining })}</p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedFor(null)}
                aria-label={t('close')}
                className="text-[#9CA3AF] shrink-0"
              >
                <X size={20} aria-hidden />
              </button>
            </div>

            <p className="text-sm text-[#111827]">{t('sharingExplainer')}</p>
            <p className="text-xs text-[#6B7280]">{t('consentStale')}</p>

            <button
              type="button"
              onClick={() => void stop()}
              className="w-full bg-[#2BBFAA] text-white font-semibold py-3 px-4 rounded-xl"
            >
              {t('stop')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
