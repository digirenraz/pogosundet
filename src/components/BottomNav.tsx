'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Users, Swords, MessageCircle, User } from 'lucide-react';
import { useUnread } from '@/components/UnreadProvider';

// Bottom navigation bar. Shown on all authenticated "app" pages.
// The Chat tab carries a live unread badge. The unread total comes from the
// shared UnreadProvider (mounted once in the [locale] layout) rather than
// running the unread hooks per-instance — this avoids the badge flicker that
// occurred when BottomNav remounted on every navigation.
export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('BottomNav');

  const { total: unreadTotal } = useUnread();

  const isActive = (path: string) => pathname.endsWith(path);
  // Profile tab is active for /profile and /profile/edit alike.
  const isProfileActive = /\/profile(\/.*)?$/.test(pathname);

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 z-10">
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

      {/* Chat — live unread badge (channels + DMs) */}
      <Link
        href="/chat"
        className={`relative flex flex-col items-center justify-center gap-1 w-16 ${isActive('/chat') || pathname.includes('/chat/') ? 'text-primary' : 'text-muted-foreground'}`}
      >
        <span className="relative">
          <MessageCircle size={24} />
          {unreadTotal > 0 && (
            <span
              aria-label={`${unreadTotal} ulæste beskeder`}
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold inline-flex items-center justify-center"
            >
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </span>
          )}
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
