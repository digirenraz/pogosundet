'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Users, Swords, MessageCircle, User } from 'lucide-react';

// Bottom navigation bar. Shown on all authenticated "app" pages.
// All four tabs are now live; chat unread badges are wired in a follow-up.
export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('BottomNav');

  const isActive = (path: string) => pathname.endsWith(path);
  // Profile tab is active for /profile and /profile/edit alike.
  const isProfileActive = /\/profile(\/.*)?$/.test(pathname);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 z-10">
      {/* Players */}
      <Link
        href="/players"
        className={`flex flex-col items-center justify-center gap-1 w-16 ${isActive('/players') ? 'text-primary' : 'text-muted-foreground'}`}
      >
        <Users size={24} />
        <span className="text-[11px] font-semibold">{t('players')}</span>
      </Link>

      {/* Raids */}
      <Link
        href="/raids"
        className={`flex flex-col items-center justify-center gap-1 w-16 ${isActive('/raids') ? 'text-primary' : 'text-muted-foreground'}`}
      >
        <Swords size={24} />
        <span className="text-[11px] font-semibold">{t('raids')}</span>
      </Link>

      {/* Chat — unread count wired in a follow-up; slot reserved. */}
      <Link
        href="/chat"
        className={`relative flex flex-col items-center justify-center gap-1 w-16 ${isActive('/chat') || pathname.includes('/chat/') ? 'text-primary' : 'text-muted-foreground'}`}
      >
        <span className="relative">
          <MessageCircle size={24} />
          {/* Unread count wired in a follow-up — slot reserved. */}
          <span className="hidden absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold items-center justify-center" />
        </span>
        <span className="text-[11px] font-semibold">{t('chat')}</span>
      </Link>

      {/* Profile */}
      <Link
        href="/profile"
        className={`flex flex-col items-center justify-center gap-1 w-16 ${isProfileActive ? 'text-primary' : 'text-muted-foreground'}`}
      >
        <User size={24} />
        <span className="text-[11px] font-semibold">{t('profile')}</span>
      </Link>
    </div>
  );
}
