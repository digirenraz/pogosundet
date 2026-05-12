'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Profile } from '@/lib/profile/helpers';
import { Avatar, TEAMS, type AvatarTeam } from './Avatar';

interface PlayerCardProps {
  profile: Profile;
  online?: boolean;
}

export function PlayerCard({ profile, online = false }: PlayerCardProps) {
  const t = useTranslations('PlayerDirectory');
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(profile.friend_code);
    } catch {
      // Clipboard can fail silently in iframes / older browsers; ignore.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const team = (profile.team ?? 'none') as AvatarTeam;
  const teamMeta = TEAMS[team];

  return (
    <Link
      href={`/players/${profile.id}`}
      className="bg-card border border-border rounded-lg p-3.5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <Avatar
          src={profile.avatar_url}
          name={profile.first_name || profile.trainer_name}
          size={52}
          team={team}
          online={online}
          level={profile.level ?? null}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-bold text-card-foreground truncate">
              {profile.trainer_name}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {profile.first_name && (
              <span className="text-[13px] text-muted-foreground">{profile.first_name}</span>
            )}
            {online && (
              <span className="text-[12px] font-semibold text-primary">· {t('onlineLabel')}</span>
            )}
          </div>
        </div>
        {team !== 'none' && (
          <span
            className="inline-flex items-center justify-center rounded-full text-white font-extrabold flex-shrink-0"
            style={{
              width: 24,
              height: 24,
              background: teamMeta.color,
              fontSize: 12,
            }}
          >
            {teamMeta.short}
          </span>
        )}
      </div>

      {profile.bio && (
        <p className="text-[14px] text-card-foreground leading-snug line-clamp-2">{profile.bio}</p>
      )}

      <div className="bg-muted rounded-md px-3 py-2 flex items-center justify-between">
        <span className="text-[15px] font-semibold tracking-wider text-muted-foreground tabular-nums">
          {profile.friend_code}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-[13px] font-semibold flex items-center gap-1.5"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? t('copiedButton') : t('copyButton')}
        </button>
      </div>
    </Link>
  );
}
