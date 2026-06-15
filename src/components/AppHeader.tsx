'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { AppMenu } from '@/components/AppMenu';

// ---------------------------------------------------------------------------
// AppHeader — the branded top header for the main mobile tab screens
// (Players, Raids, Chat, Profil).
//
// Two stacked rows (design handoff `branded_header`):
//   Row 1: hamburger (AppMenu) · 30px app icon · "PoGoSundet" wordmark   |  action?
//   Row 2: the screen name as a large title.
//
// The wordmark is a brand proper noun (identical in every locale) so it is a
// hardcoded constant, not an i18n string. The brand-ink colours (#0a222b /
// #0a1f27) have no @theme token — the `foreground` token is pure black — so
// they are hardcoded per the handoff.
//
// Mobile-only by design: Players/Profil render this inside their `lg:hidden`
// blocks, and Raids/Chat wrap it in `lg:hidden` (desktop is branded by the
// sidebar instead). The component itself is layout-agnostic — callers decide
// where it shows.
// ---------------------------------------------------------------------------

interface AppHeaderProps {
  /** Screen name shown as the large Row-2 title (already translated). */
  title: string;
  /** Optional right-hand action in Row 1 — e.g. the Raids "+" link. */
  action?: ReactNode;
}

export function AppHeader({ title, action }: AppHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-10 bg-card border-b border-border pt-2.5 px-3.5 pb-3">
      {/* Row 1: brand lockup + optional action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[9px] min-w-0">
          <AppMenu />
          <Image
            src="/icon-192.png"
            alt=""
            width={30}
            height={30}
            priority
            className="rounded-lg shadow-[0_2px_5px_rgba(10,34,43,0.22)]"
          />
          <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#0a222b]">
            PoGoSundet
          </span>
        </div>
        {action}
      </div>

      {/* Row 2: large screen title */}
      <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-[#0a1f27] mt-3 mx-0.5">
        {title}
      </h1>
    </header>
  );
}
