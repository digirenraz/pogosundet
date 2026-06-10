'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Users, Swords, MessageCircle, User, MapPinned, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Team } from '@/lib/profile/validation';
import { useUnread } from '@/components/UnreadProvider';
import { Avatar, TEAMS, type AvatarTeam } from '@/components/Avatar';

// Minimal shape for the bottom user chip — accepts a full Profile or the lighter
// profile rows used elsewhere (e.g. chat's OnlineStripProfile).
export interface SidebarUser {
  trainer_name: string;
  first_name?: string | null;
  avatar_url?: string | null;
  team?: Team | null;
  level?: number | null;
}

interface DesktopSidebarProps {
  /** The logged-in user's own profile — drives the bottom user chip. */
  me?: SidebarUser;
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

interface SidebarNavContentProps {
  /** Whether this item is the current route — active styling always wins. */
  active: boolean;
  icon: LucideIcon;
  label: string;
  /** Unread count for this surface; 0 hides the badge. */
  badgeCount: number;
}

// Nav-item content rendered INSIDE each <Link> — useLinkStatus reads the
// pending state of the closest ancestor Link, so it can't live in the sidebar
// component itself. While a navigation is in flight (slow RSC fetch, cold
// Router Cache) the item tints primary and the icon pulses, so a click
// responds instantly instead of appearing dead until the route streams in.
// Pure perceived-performance feedback; mirrors BottomNav's NavTabContent.
function SidebarNavContent({ active, icon: Icon, label, badgeCount }: SidebarNavContentProps) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={`flex items-center gap-3 w-full ${
        pending && !active ? 'text-primary' : ''
      }`}
    >
      <Icon size={20} className={pending ? 'animate-pulse' : undefined} />
      <span className="flex-1 text-[14px]">{label}</span>
      {badgeCount > 0 && (
        <span
          className="text-white text-[10px] font-extrabold px-[7px] py-[2px] rounded-full"
          style={{ background: 'var(--color-team-valor)' }}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </span>
  );
}

// Labeled left navigation for the desktop layout. Mirrors BottomNav's routes
// and live Chat + Raids unread badges, but in the desktop sidebar form from
// the design. Rendered only at lg+ (the caller gates visibility); mobile
// keeps BottomNav.
export function DesktopSidebar({ me }: DesktopSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('BottomNav');
  const { chatUnread, raidUnread } = useUnread();

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
    <nav className="w-[244px] h-full flex-shrink-0 bg-card border-r border-border flex flex-col px-3.5 py-5">
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
          // Each nav item shows its own surface's unread total — Raids gets
          // joined-raid chat messages, Chat gets channels + DMs (issue #104
          // split a single combined `total` into per-surface counts so the
          // Raids badge doesn't double-count chat unread, and vice versa).
          const badgeCount = it.key === 'chat' ? chatUnread : it.key === 'raids' ? raidUnread : 0;
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
              <SidebarNavContent
                active={on}
                icon={Icon}
                label={t(it.labelKey)}
                badgeCount={badgeCount}
              />
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
