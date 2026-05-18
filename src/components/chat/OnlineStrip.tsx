'use client';

import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/Avatar';
import type { Team } from '@/lib/profile/validation';

export interface OnlineStripProfile {
  user_id: string;
  trainer_name: string;
  avatar_url: string | null;
  team: Team | null;
  level: number | null;
}

interface OnlineStripProps {
  profiles: OnlineStripProfile[];
  onlineIds: Set<string>;
  totalMembers: number;
  currentUserId: string | null;
}

// Horizontal "Online nu" strip used at the top of the channel list.
// Renders all online profiles; pure decorative — no click handler (DMs deferred).
export function OnlineStrip({ profiles, onlineIds, totalMembers, currentUserId }: OnlineStripProps) {
  const t = useTranslations('Chat');
  const online = profiles.filter((p) => onlineIds.has(p.user_id));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex justify-between items-baseline px-1 gap-2">
        <span className="text-[13px] font-bold text-card-foreground uppercase tracking-wider whitespace-nowrap">
          {t('onlineNow')}
        </span>
        <span className="text-[12px] font-semibold text-muted-foreground whitespace-nowrap">
          {t('onlineCountOf', { n: online.length, total: totalMembers })}
        </span>
      </div>

      {online.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic px-1">{t('noOneOnline')}</p>
      ) : (
        <div
          className="flex gap-3.5 overflow-x-auto overflow-y-visible pb-1 px-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {online.map((p) => (
            <div
              key={p.user_id}
              className="flex flex-col items-center gap-1.5 shrink-0"
              style={{ width: 60 }}
            >
              <Avatar
                src={p.avatar_url}
                name={p.trainer_name}
                team={p.team ?? 'none'}
                level={p.level}
                online
                ring
                size={48}
              />
              <span className="text-[11px] font-semibold text-card-foreground max-w-[60px] truncate">
                {p.user_id === currentUserId ? t('you') : p.trainer_name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
