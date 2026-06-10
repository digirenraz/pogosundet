'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Users, Swords, MessageCircle, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUnread } from '@/components/UnreadProvider';

interface NavTabContentProps {
  /** Whether this tab is the current route — active styling always wins. */
  active: boolean;
  icon: LucideIcon;
  label: string;
  /** Optional unread badge, positioned over the icon. */
  badge?: React.ReactNode;
}

// Tab content rendered INSIDE each <Link> — useLinkStatus reads the pending
// state of the closest ancestor Link, so it can't live in BottomNav itself.
// While a navigation is in flight (slow RSC fetch, cold Router Cache after the
// app sat idle) the tab tints primary and the icon pulses, so a tap responds
// instantly instead of appearing dead until the new route streams in. Pure
// perceived-performance feedback; the active style wins when already there.
function NavTabContent({ active, icon: Icon, label, badge }: NavTabContentProps) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={`flex flex-col items-center justify-center gap-1 ${
        pending && !active ? 'text-primary' : ''
      }`}
    >
      <span className="relative">
        <Icon size={24} className={pending ? 'animate-pulse' : undefined} />
        {badge}
      </span>
      <span className="text-[11px] font-semibold">{label}</span>
    </span>
  );
}

// Bottom navigation bar. Shown on all authenticated "app" pages.
// The Chat and Raids tabs each carry their own live unread badge. Both totals
// come from the shared UnreadProvider (mounted once in the [locale] layout)
// rather than running the unread hooks per-instance — this avoids the badge
// flicker that occurred when BottomNav remounted on every navigation.
export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('BottomNav');

  const { chatUnread, raidUnread } = useUnread();

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
        <NavTabContent active={isActive('/players')} icon={Users} label={t('players')} />
      </Link>

      {/* Raids — live unread badge (joined raids' chat messages) */}
      <Link
        href="/raids"
        className={`relative flex flex-col items-center justify-center gap-1 w-16 ${isActive('/raids') ? 'text-primary' : 'text-muted-foreground'}`}
      >
        <NavTabContent
          active={isActive('/raids')}
          icon={Swords}
          label={t('raids')}
          badge={
            raidUnread > 0 && (
              <span
                aria-label={`${raidUnread} ulæste raid-beskeder`}
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold inline-flex items-center justify-center"
              >
                {raidUnread > 99 ? '99+' : raidUnread}
              </span>
            )
          }
        />
      </Link>

      {/* Chat — live unread badge (channels + DMs) */}
      <Link
        href="/chat"
        className={`relative flex flex-col items-center justify-center gap-1 w-16 ${isActive('/chat') || pathname.includes('/chat/') ? 'text-primary' : 'text-muted-foreground'}`}
      >
        <NavTabContent
          active={isActive('/chat') || pathname.includes('/chat/')}
          icon={MessageCircle}
          label={t('chat')}
          badge={
            chatUnread > 0 && (
              <span
                aria-label={`${chatUnread} ulæste beskeder`}
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold inline-flex items-center justify-center"
              >
                {chatUnread > 99 ? '99+' : chatUnread}
              </span>
            )
          }
        />
      </Link>

      {/* Profile */}
      <Link
        href="/profile"
        className={`flex flex-col items-center justify-center gap-1 w-16 ${isProfileActive ? 'text-primary' : 'text-muted-foreground'}`}
      >
        <NavTabContent active={isProfileActive} icon={User} label={t('profile')} />
      </Link>
    </div>
  );
}
