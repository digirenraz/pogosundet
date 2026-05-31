'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Check, Share2, MapPin, MessageCircle, Users, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RaidWithAttendees } from '@/lib/raids/server-helpers';
import { groupRaidReactions } from '@/lib/raids/raid-reaction-helpers';

interface RaidCardProps {
  raid: RaidWithAttendees;
  currentUserId: string;
  onJoin: (raidId: string) => void;
  onLeave: (raidId: string) => void;
  onUpdateExtra: (raidId: string, extra: number) => void;
  expired?: boolean;
}

// Human-readable relative time based on starts_at (or created_at as fallback).
function relativeTime(
  raid: RaidWithAttendees,
  t: ReturnType<typeof useTranslations<'Raids'>>
): string {
  const reference = raid.starts_at ?? raid.created_at;
  const diffMs = Date.now() - new Date(reference).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < -1) return t('startsIn', { minutes: Math.abs(diffMin) });
  if (diffMin <= 1) return t('startedJustNow');
  return t('startedAgo', { minutes: diffMin });
}

export function RaidCard({
  raid,
  currentUserId,
  onJoin,
  onLeave,
  onUpdateExtra,
  expired = false,
}: RaidCardProps) {
  const t = useTranslations('Raids');
  const [shared, setShared] = useState(false);

  // Find the current user's attendee record (for extra_count initialization)
  const myAttendee = raid.raid_attendees.find(a => a.user_id === currentUserId);
  const isJoined = !!myAttendee;

  // Local extra count state — initialized from DB value if already attending
  const [extra, setExtra] = useState(myAttendee?.extra_count ?? 0);

  const timeLabel = relativeTime(raid, t);

  // Total trainer count = 1 per attendee + their extras
  const totalTrainers = raid.raid_attendees.reduce((sum, a) => sum + 1 + (a.extra_count ?? 0), 0);
  const messageCount = raid.raid_messages?.length ?? 0;

  // Poster's trainer name — the poster is auto-joined so they appear in attendees
  const posterName =
    raid.raid_attendees.find(a => a.user_id === raid.user_id)?.profiles?.trainer_name ?? null;

  const isCompleted = !!raid.completed_at;

  // Read-only raid-reaction counts for the card summary.
  const reactionGroups = groupRaidReactions(raid.raid_reactions ?? []);
  const reactionSummary: { key: string; label: string; count: number }[] = [
    { key: 'tfr', label: t('reactionTfr'), count: reactionGroups.tfr.length },
    { key: 'shiny', label: '✨', count: reactionGroups.shiny.length },
    { key: 'hundo', label: '💯', count: reactionGroups.hundo.length },
  ].filter(r => r.count > 0);

  async function handleShare() {
    const parts = [
      raid.boss_name && `Boss: ${raid.boss_name}`,
      raid.gym_name && `Gym: ${raid.gym_name}`,
      timeLabel,
      raid.note,
    ]
      .filter(Boolean)
      .join('\n');

    // Preferred: share the original Pokémon GO screenshot so it can be posted
    // straight to Messenger exactly like players do today. The screenshot itself
    // carries the raid details (boss, CP, gym); we attach the parsed details as
    // text too (some share targets keep it, some drop it — the image still has it).
    if (raid.image_url && typeof navigator !== 'undefined' && navigator.canShare) {
      let file: File | null = null;
      try {
        const res = await fetch(raid.image_url);
        const blob = await res.blob();
        const ext = (blob.type.split('/')[1] || 'jpg').split('+')[0];
        file = new File([blob], `raid.${ext}`, { type: blob.type || 'image/jpeg' });
      } catch {
        file = null; // fetch/CORS failed — fall through to the link share below
      }
      if (file && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: parts });
        } catch {
          // User dismissed the sheet, or the share failed — either way, don't
          // open a second (link) share sheet on top of it.
        }
        return;
      }
    }

    // Fallback: no screenshot, or the platform can't share files (e.g. desktop).
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/raids/${raid.id}`
        : `/raids/${raid.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Raid på PoGoSundet', text: parts, url });
      } catch {
        // Swallow AbortError (user dismissed the native share sheet).
      }
    } else {
      await navigator.clipboard.writeText(`${parts}\n${url}`);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }

  function handleExtraChange(delta: number) {
    const next = Math.max(0, Math.min(9, extra + delta));
    setExtra(next);
    onUpdateExtra(raid.id, next);
  }

  const cardContent = (
    <div className={`bg-card border border-border rounded-xl overflow-hidden${expired ? ' opacity-50' : ''}`}>
      {/* Top row — links to detail screen */}
      <Link href={`/raids/${raid.id}`} className="flex">
        {/* Left thumbnail */}
        <div className="relative w-[108px] shrink-0 bg-input">
          {raid.image_url ? (
            <Image
              src={raid.image_url}
              alt="Raid screenshot"
              fill
              sizes="108px"
              className={`object-contain${expired ? ' grayscale' : ''}`}
            />
          ) : (
            <div className="w-full h-full min-h-[80px] flex items-center justify-center bg-secondary">
              <span className="text-[28px]">⚔️</span>
            </div>
          )}
        </div>

        {/* Right content */}
        <div className="p-3 flex flex-col gap-1 min-w-0 flex-1">
          {/* Boss name */}
          {raid.boss_name && (
            <p className="text-[16px] font-extrabold truncate text-card-foreground">
              {raid.boss_name}
            </p>
          )}
          {/* Gym name */}
          {raid.gym_name && (
            <p className="text-[13px] text-muted-foreground flex items-center gap-1 truncate">
              <MapPin size={13} className="shrink-0" />
              <span className="truncate">{raid.gym_name}</span>
            </p>
          )}
          {/* Metadata: time · poster */}
          <p className="text-[12px] text-muted-foreground">
            {timeLabel}
            {posterName ? ` · ${posterName}` : ''}
          </p>
          {/* Completed badge */}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 self-start rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
              <Check size={11} />
              {t('completed')}
            </span>
          )}
          {/* Read-only reaction summary — only when there are reactions */}
          {reactionSummary.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[12px] font-semibold text-muted-foreground">
              {reactionSummary.map(r => (
                <span key={r.key} className="flex items-center gap-0.5">
                  {r.label} {r.count}
                </span>
              ))}
            </div>
          )}
          {/* Stats row */}
          <div className="flex gap-3 text-[12px] text-muted-foreground mt-auto pt-1">
            <span className="flex items-center gap-1">
              <MessageCircle size={12} />
              {messageCount}
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} />
              {totalTrainers}
            </span>
          </div>
        </div>
      </Link>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* RSVP strip — hidden on expired cards */}
      {!expired && (
        <div className="px-3 py-2.5 flex items-center gap-2">
          {/* Join / Leave button */}
          <button
            onClick={() => (isJoined ? onLeave(raid.id) : onJoin(raid.id))}
            className={`flex-1 h-10 rounded-lg text-[14px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
              isJoined
                ? 'bg-primary border-primary text-primary-foreground'
                : 'bg-background border-border text-card-foreground'
            }`}
          >
            {isJoined && <Check size={15} />}
            {t('detail.joinButton')}
          </button>

          {/* Extra people stepper — only visible when joined */}
          {isJoined && (
            <div className="flex items-center gap-1 bg-input rounded-lg px-2 h-10">
              <button
                type="button"
                disabled={extra === 0}
                onClick={() => handleExtraChange(-1)}
                className="w-7 h-7 flex items-center justify-center text-muted-foreground disabled:opacity-40"
                aria-label="Færre"
              >
                <Minus size={14} />
              </button>
              <span className="text-[15px] font-bold text-primary w-5 text-center">{extra}</span>
              <button
                type="button"
                disabled={extra === 9}
                onClick={() => handleExtraChange(1)}
                className="w-7 h-7 flex items-center justify-center text-muted-foreground disabled:opacity-40"
                aria-label="Flere"
              >
                <Plus size={14} />
              </button>
            </div>
          )}

          {/* Share button */}
          <button
            onClick={handleShare}
            className="w-10 h-10 border border-border rounded-lg flex items-center justify-center text-muted-foreground"
            aria-label={t('shareButton')}
          >
            {shared ? <Check size={16} className="text-primary" /> : <Share2 size={16} />}
          </button>
        </div>
      )}
    </div>
  );

  return cardContent;
}
