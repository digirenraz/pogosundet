'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeftRight, Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Profile } from '@/lib/profile/helpers';
import { lastSeenRelative } from '@/lib/profile/time';
import dynamic from 'next/dynamic';
import { Avatar, TeamChip, TEAMS, type AvatarTeam } from './Avatar';
import { FriendCodeHidden } from './FriendCodeHidden';

// Lazy-load the QR so the `qrcode` lib (~31 KB) is fetched on demand instead of
// shipping in the player-detail route's initial bundle. `ssr: false` also keeps
// the QR SVGs out of the server-rendered HTML — the deck mounts one QR per
// profile in the whole directory, so that HTML adds up fast. The fixed-size
// placeholder reserves the 224px box so nothing shifts while the chunk loads.
const FriendCodeQR = dynamic(() => import('./FriendCodeQR').then((m) => m.FriendCodeQR), {
  ssr: false,
  loading: () => <div className="rounded-md bg-background" style={{ width: 224, height: 224 }} />,
});

interface PlayerDetailDeckProps {
  profiles: Profile[];
  startIndex: number;
  onlineUserIds: Set<string>;
}

// Swipe-deck of player detail cards. Touch + mouse drag, side chevrons, dots.
// Server stays the source of truth for the profile data; only navigation /
// drag state lives here.
export function PlayerDetailDeck({ profiles, startIndex, onlineUserIds }: PlayerDetailDeckProps) {
  const t = useTranslations('PlayerDetail');
  const router = useRouter();

  const [idx, setIdx] = useState(startIndex);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const startX = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // Measure deck width once mounted so the transform matches the viewport.
  useEffect(() => {
    if (!trackRef.current) return;
    const el = trackRef.current;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function startDrag(x: number) {
    startX.current = x;
    setDragging(true);
    setDrag(0);
  }
  function moveDrag(x: number) {
    if (!dragging) return;
    setDrag(x - startX.current);
  }
  function endDrag() {
    if (!dragging) return;
    const threshold = 60;
    if (drag < -threshold && idx < profiles.length - 1) setIdx(idx + 1);
    else if (drag > threshold && idx > 0) setIdx(idx - 1);
    setDrag(0);
    setDragging(false);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard unavailable; soft-fail.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const total = profiles.length;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="h-[60px] flex-shrink-0 border-b border-border flex items-center justify-between px-3 bg-background z-10">
        <button
          type="button"
          onClick={() => router.push('/players')}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          aria-label={t('back')}
        >
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <div className="text-[13px] font-semibold text-muted-foreground">
          {idx + 1} / {total}
        </div>
        <div className="w-10 h-10" />
      </div>

      {/* Swipe deck */}
      <div
        ref={trackRef}
        className="flex-1 relative overflow-hidden bg-[#f7f9f8]"
        onMouseDown={(e) => startDrag(e.clientX)}
        onMouseMove={(e) => moveDrag(e.clientX)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchStart={(e) => startDrag(e.touches[0].clientX)}
        onTouchMove={(e) => moveDrag(e.touches[0].clientX)}
        onTouchEnd={endDrag}
      >
        <div
          className="flex h-full"
          style={{
            width: width * total,
            transform: `translateX(${-idx * width + drag}px)`,
            transition: dragging ? 'none' : 'transform 0.32s cubic-bezier(.2,.7,.2,1)',
            willChange: 'transform',
          }}
        >
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex-shrink-0 h-full px-5 pt-5 pb-3 overflow-y-auto box-border"
              style={{ width }}
            >
              <PlayerDetailCard
                profile={p}
                online={onlineUserIds.has(p.user_id)}
                copied={copied}
                onCopy={() => copyCode(p.friend_code)}
              />
            </div>
          ))}
        </div>

        {idx > 0 && (
          <button
            type="button"
            onClick={() => setIdx(idx - 1)}
            className="absolute top-1/2 left-2 -translate-y-1/2 w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center shadow-md z-10"
            aria-label={t('previous')}
          >
            <ChevronLeft size={18} className="text-foreground" />
          </button>
        )}
        {idx < total - 1 && (
          <button
            type="button"
            onClick={() => setIdx(idx + 1)}
            className="absolute top-1/2 right-2 -translate-y-1/2 w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center shadow-md z-10"
            aria-label={t('next')}
          >
            <ChevronRight size={18} className="text-foreground" />
          </button>
        )}
      </div>

      {/* Pagination dots */}
      <div className="flex-shrink-0 py-3 flex justify-center gap-1.5 bg-background border-t border-border">
        {profiles.map((_, i) => (
          <span
            key={i}
            className="rounded-full transition-all"
            style={{
              width: i === idx ? 18 : 6,
              height: 6,
              background: i === idx ? 'var(--color-primary)' : 'var(--color-border)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface PlayerDetailCardProps {
  profile: Profile;
  online: boolean;
  copied: boolean;
  onCopy: () => void;
}

function PlayerDetailCard({ profile, online, copied, onCopy }: PlayerDetailCardProps) {
  const t = useTranslations('PlayerDetail');
  const team = (profile.team ?? 'none') as AvatarTeam;
  const teamMeta = TEAMS[team];

  return (
    <div className="flex flex-col gap-4 pb-6 select-none">
      {/* Identity */}
      <div
        className="rounded-2xl px-4 py-5 text-center"
        style={{
          background:
            team !== 'none'
              ? `color-mix(in srgb, ${teamMeta.color} 8%, transparent)`
              : 'var(--color-card)',
          border:
            team !== 'none'
              ? `1px solid color-mix(in srgb, ${teamMeta.color} 20%, transparent)`
              : '1px solid var(--color-border)',
        }}
      >
        <div className="flex justify-center mb-2.5">
          <Avatar
            src={profile.avatar_url}
            name={profile.first_name || profile.trainer_name}
            size={96}
            team={team}
            online={online}
            level={profile.level ?? null}
            ringWidth={4}
          />
        </div>
        <div className="text-[20px] font-extrabold tracking-tight text-foreground">
          {profile.trainer_name}
        </div>
        {profile.first_name && (
          <div className="text-[14px] text-muted-foreground mt-0.5">{profile.first_name}</div>
        )}
        <div className="inline-flex gap-1.5 mt-2.5 flex-wrap justify-center">
          <TeamChip team={team} />
          {profile.level != null && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
              style={{ background: '#1b3a52', color: 'var(--color-team-instinct)' }}
            >
              <span
                className="inline-flex items-center justify-center rounded-full font-extrabold"
                style={{
                  width: 16,
                  height: 16,
                  background: 'var(--color-team-instinct)',
                  color: '#1b3a52',
                  fontSize: 10,
                }}
              >
                {profile.level}
              </span>
              {t('levelChip', { level: profile.level })}
            </span>
          )}
          {online && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
              style={{ background: '#e3f8e6', color: '#0a8a17' }}
            >
              <span className="w-2 h-2 rounded-full bg-success" />
              {t('onlineLabel')}
            </span>
          )}
        </div>
        {!online && profile.last_seen_at && (
          <span className="text-[11px] text-muted-foreground font-medium mt-1">
            {lastSeenRelative(profile.last_seen_at, new Date())}
          </span>
        )}
      </div>

      {/* QR */}
      <div className="bg-background border border-border rounded-2xl p-4 flex flex-col items-center gap-3">
        <div className="text-[11px] tracking-widest font-bold text-muted-foreground uppercase">
          {t('qrSectionLabel')}
        </div>
        {profile.hide_friend_code ? (
          <FriendCodeHidden size={224} />
        ) : (
          <>
            <span
              className="text-[20px] font-bold tracking-widest tabular-nums"
              style={{ color: '#1b3a52' }}
            >
              {profile.friend_code}
            </span>
            <FriendCodeQR value={profile.friend_code} size={224} />
            <p className="text-[12px] text-muted-foreground text-center max-w-[240px] leading-snug">
              {t('qrInstructions')}
            </p>
            <button
              type="button"
              onClick={onCopy}
              className="w-full h-11 rounded-md text-primary-foreground font-semibold inline-flex items-center justify-center gap-1.5 text-[14px] transition-colors"
              style={{ background: copied ? 'var(--color-success)' : 'var(--color-primary)' }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? t('copiedButton') : t('copyButton')}
            </button>
          </>
        )}
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="bg-card border border-border rounded-lg p-3.5">
          <div className="text-[11px] tracking-widest font-bold text-muted-foreground uppercase mb-2">
            {t('bioLabel')}
          </div>
          <p className="text-[14px] text-card-foreground leading-relaxed">{profile.bio}</p>
        </div>
      )}

      {/* Swipe hint */}
      <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-[12px] font-semibold">
        <ChevronsLeftRight size={14} />
        {t('swipeHint')}
      </div>
    </div>
  );
}
