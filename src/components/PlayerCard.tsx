'use client';

import { useState } from 'react';
import { User, Copy, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Profile } from '@/lib/profile/helpers';

interface PlayerCardProps {
  profile: Profile;
}

export function PlayerCard({ profile }: PlayerCardProps) {
  const t = useTranslations('PlayerDirectory');
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(profile.friend_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
      {/* Header row: avatar + name */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={profile.trainer_name} className="w-full h-full object-cover" />
          ) : (
            <User size={24} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-bold text-card-foreground truncate">{profile.trainer_name}</p>
          {profile.first_name && (
            <p className="text-[13px] text-muted-foreground truncate">{profile.first_name}</p>
          )}
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <p className="text-[14px] text-card-foreground leading-snug">{profile.bio}</p>
      )}

      {/* Friend code + copy button */}
      <div className="bg-muted rounded-md px-3 py-2 flex items-center justify-between mt-1">
        <span className="text-[16px] font-semibold tracking-wider text-muted-foreground">
          {profile.friend_code}
        </span>
        <button
          onClick={handleCopy}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-[13px] font-semibold flex items-center gap-1.5"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? t('copiedButton') : t('copyButton')}
        </button>
      </div>
    </div>
  );
}
