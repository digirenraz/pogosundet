'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Users, Swords, MessageCircle, User, MapPinned, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Profile } from '@/lib/profile/helpers';
import { useUnread } from '@/components/UnreadProvider';
import { Avatar, TEAMS, type AvatarTeam } from '@/components/Avatar';

interface DesktopSidebarProps {
  /** The logged-in user's own profile — drives the bottom user chip. */
  me?: Profile;
}

interface NavItem {
  key: string;
  icon: LucideIcon;
  labelKey: 'players' | 'raids' | 'chat' | 'profile';
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'spillere', icon: Users, labelKey: 'players', href: '/players' },
  { key: 'raids', icon: Swords, labelKey: 'raids', href: '/raids' },
  { key: 'chat', icon: MessageCircle, labelKey: 'chat', href: '/chat' },
  { key: 'profil', icon: User, labelKey: 'profile', href: '/profile' },
];

// Labeled left navigation for the desktop layout. Mirrors BottomNav's routes
// and live Chat unread badge, but in the desktop sidebar form from the design.
// Rendered only at lg+ (the caller gates visibility); mobile keeps BottomNav.
export function DesktopSidebar({ me }: DesktopSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('BottomNav');
  const { total: unreadTotal } = useUnread();

  // Active item: match the route suffix (locale prefix is as-needed, so paths
  // are /players, /raids, etc.). Chat stays active inside /chat/* sub-routes.
  const activeKey = (() => {
    if (/\/chat(\/.*)?$/.test(pathname)) return 'chat';
    if (/\/raids(\/.*)?$/.test(pathname)) return 'raids';
    if (/\/profile(\/.*)?$/.test(pathname)) return 'profil';
    return 'spillere';
  })();

  const team = (me?.team ?? 'none') as AvatarTeam;
  const teamMeta = TEAMS[team];

  return (
    <nav className="w-[244px] flex-shrink-0 bg-card border-r border-border flex flex-col px-3.5 py-5">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 pt-1 pb-[18px]">
        <div
          className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center"
          style={{ boxShadow: '0 4px 12px rgba(0,176,159,0.3)' }}
        >
          <MapPinned size={20} className="text-primary-foreground" />
        </div>
        <div>
          <div className="text-[16px] font-extrabold leading-none tracking-tight">PoGoSundet</div>
          <div className="text-[11px] text-muted-foreground mt-[3px]">Frederikssund</div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex flex-col gap-1">
        {NAV_ITEMS.map((it) => {
          const on = activeKey === it.key;
          const Icon = it.icon;
          return (
            <Link
              key={it.key}
              href={it.href}
              className="flex items-center gap-3 px-3 py-[11px] rounded-[10px]"
              style={{
                background: on ? 'var(--color-secondary)' : 'transparent',
                color: on ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                fontWeight: on ? 700 : 600,
              }}
            >
              <Icon size={20} />
              <span className="flex-1 text-[14px]">{t(it.labelKey)}</span>
              {it.key === 'chat' && unreadTotal > 0 && (
                <span
                  className="text-white text-[10px] font-extrabold px-[7px] py-[2px] rounded-full"
                  style={{ background: 'var(--color-team-valor)' }}
                >
                  {unreadTotal > 99 ? '99+' : unreadTotal}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* User chip */}
      {me && (
        <Link
          href="/profile"
          className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-background"
        >
          <Avatar
            src={me.avatar_url}
            name={me.first_name || me.trainer_name}
            size={36}
            team={team}
            online
          />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold truncate">{me.trainer_name}</div>
            <div className="text-[11px] text-muted-foreground">
              {teamMeta.label !== '—' ? `Team ${teamMeta.label}` : '—'}
              {me.level != null && ` · Lvl ${me.level}`}
            </div>
          </div>
          <Settings size={16} className="text-muted-foreground" />
        </Link>
      )}
    </nav>
  );
}
