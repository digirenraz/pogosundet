'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Copy, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Profile } from '@/lib/profile/helpers';
import { Avatar, TeamChip, LevelPill, TEAMS, type AvatarTeam } from '@/components/Avatar';
import { FriendCodeQR } from '@/components/FriendCodeQR';

interface DesktopProfileProps {
  profile: Profile;
}

// Desktop "Min profil" — two-column layout (identity + bio card | friend-code QR
// card), mirroring the design mock on real profile data. Reuses Avatar, TeamChip,
// LevelPill and the real scannable FriendCodeQR. Client for the copy button.
export function DesktopProfile({ profile }: DesktopProfileProps) {
  const t = useTranslations('ProfileTab');
  const tDir = useTranslations('PlayerDirectory');
  const tDetail = useTranslations('PlayerDetail');
  const [copied, setCopied] = useState(false);

  const team = (profile.team ?? 'none') as AvatarTeam;
  const teamMeta = TEAMS[team];

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(profile.friend_code);
    } catch {
      // Clipboard can fail silently in iframes / older browsers; ignore.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-8 pt-6">
        <div className="text-[24px] font-extrabold tracking-tight">{t('headerTitle')}</div>
        <div className="text-[14px] text-muted-foreground mt-0.5">{t('desktopSubtitle')}</div>
      </div>

      <div className="px-8 py-6 grid grid-cols-[1fr_380px] gap-5 items-start max-w-[1100px]">
        {/* Identity + bio card */}
        <div className="bg-card border border-border rounded-[18px] overflow-hidden">
          {/* Team banner */}
          <div
            className="h-24 relative"
            style={{
              background:
                team === 'none'
                  ? 'linear-gradient(120deg, var(--color-muted), var(--color-border))'
                  : `linear-gradient(120deg, ${teamMeta.color}, color-mix(in srgb, ${teamMeta.color} 66%, transparent))`,
            }}
          />
          <div className="px-6 pb-6 -mt-11">
            <div className="flex items-end justify-between">
              <div className="rounded-full" style={{ boxShadow: '0 0 0 5px var(--color-background)' }}>
                <Avatar
                  src={profile.avatar_url}
                  name={profile.first_name || profile.trainer_name}
                  size={92}
                  team={team}
                  level={profile.level ?? null}
                  ringWidth={4}
                />
              </div>
              <Link
                href="/profile/edit"
                className="h-[42px] px-[18px] mb-2 rounded-[10px] bg-primary text-primary-foreground text-[14px] font-bold inline-flex items-center gap-2 whitespace-nowrap"
              >
                <Pencil size={15} />
                {t('editButton')}
              </Link>
            </div>

            <div className="text-[26px] font-extrabold tracking-tight mt-3.5">
              {profile.trainer_name}
            </div>
            {profile.first_name && (
              <div className="text-[15px] text-muted-foreground mt-0.5">{profile.first_name}</div>
            )}

            <div className="flex gap-2 mt-3.5 flex-wrap">
              <TeamChip team={team} size="md" />
              <LevelPill level={profile.level ?? null} />
              <span
                className="inline-flex items-center gap-1.5 px-3.5 py-[5px] rounded-full text-[13px] font-bold whitespace-nowrap"
                style={{ background: '#e3f8e6', color: '#0a8a17' }}
              >
                <span className="w-2 h-2 rounded-full bg-success" />
                {t('onlineNow')}
              </span>
            </div>

            {profile.bio && (
              <>
                <div className="h-px bg-border my-[22px]" />
                <div className="text-[11px] tracking-widest font-extrabold text-muted-foreground uppercase mb-2">
                  {t('bioLabel')}
                </div>
                <p className="text-[15px] text-card-foreground leading-relaxed">{profile.bio}</p>
              </>
            )}
          </div>
        </div>

        {/* Friend-code QR card */}
        <div className="bg-card border border-border rounded-[18px] p-6 flex flex-col items-center gap-3.5">
          <div className="text-[12px] tracking-widest font-extrabold text-muted-foreground uppercase">
            {tDetail('qrSectionLabel')}
          </div>
          <div
            className="p-3.5 bg-background rounded-[18px]"
            style={{ boxShadow: '0 0 0 1px var(--color-border), 0 12px 30px rgba(0,0,0,0.08)' }}
          >
            <FriendCodeQR value={profile.friend_code} size={240} />
          </div>
          <span
            className="text-[22px] font-extrabold tabular-nums whitespace-nowrap"
            style={{ letterSpacing: '0.08em', color: '#1b3a52' }}
          >
            {profile.friend_code}
          </span>
          <button
            type="button"
            onClick={copyCode}
            className="w-full h-[46px] rounded-[10px] text-primary-foreground text-[14px] font-bold inline-flex items-center justify-center gap-2"
            style={{ background: copied ? 'var(--color-success)' : 'var(--color-primary)' }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? tDir('copiedButton') : tDir('copyButton')}
          </button>
          <div className="text-[12px] text-muted-foreground text-center leading-snug">
            {t('qrHint')}
          </div>
        </div>
      </div>
    </div>
  );
}
