'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Users, Swords, MessageCircle, User } from 'lucide-react';

// Bottom navigation bar. Shown on all authenticated "app" pages.
// Players and Profile are functional; Raids and Chat are Phase 2 placeholders.
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

      {/* Chat — placeholder, Phase 2 */}
      <div className="flex flex-col items-center justify-center gap-1 w-16 text-muted-foreground cursor-not-allowed opacity-50">
        <MessageCircle size={24} />
        <span className="text-[11px] font-semibold">{t('chat')}</span>
      </div>

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
