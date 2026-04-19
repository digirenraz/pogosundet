'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Share2, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RaidWithAttendees } from '@/lib/raids/server-helpers';

interface RaidCardProps {
  raid: RaidWithAttendees;
  currentUserId: string;
  onJoin: (raidId: string) => void;
  onLeave: (raidId: string) => void;
}

// Returns a human-readable relative time string based on starts_at (or created_at as fallback).
function useRelativeTime(raid: RaidWithAttendees, t: ReturnType<typeof useTranslations<'Raids'>>) {
  const reference = raid.starts_at ?? raid.created_at;
  const diffMs = Date.now() - new Date(reference).getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin < -1) return t('startsIn', { minutes: Math.abs(diffMin) });
  if (diffMin <= 1) return t('startedJustNow');
  return t('startedAgo', { minutes: diffMin });
}

export function RaidCard({ raid, currentUserId, onJoin, onLeave }: RaidCardProps) {
  const t = useTranslations('Raids');
  const [expanded, setExpanded] = useState(false);
  const [shared, setShared] = useState(false);

  const isAttending = raid.raid_attendees.some(a => a.user_id === currentUserId);
  const attendeeCount = raid.raid_attendees.length;
  const relativeTime = useRelativeTime(raid, t);

  async function handleShare() {
    const parts = [
      raid.boss_name && `Boss: ${raid.boss_name}`,
      raid.gym_name && `Gym: ${raid.gym_name}`,
      relativeTime,
      raid.note,
    ].filter(Boolean).join('\n');

    const url = typeof window !== 'undefined' ? window.location.origin + '/raids' : '/raids';

    if (navigator.share) {
      await navigator.share({ title: 'Raid på PoGoSundet', text: parts, url });
    } else {
      await navigator.clipboard.writeText(`${parts}\n${url}`);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Screenshot */}
      {raid.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={raid.image_url} alt="Raid screenshot" className="w-full object-cover max-h-48" />
      )}

      <div className="p-4 flex flex-col gap-3">
        {/* Boss + gym */}
        <div className="flex flex-col gap-0.5">
          {raid.boss_name && (
            <p className="text-[17px] font-bold text-card-foreground">{raid.boss_name}</p>
          )}
          {raid.gym_name && (
            <p className="text-[14px] text-muted-foreground">{raid.gym_name}</p>
          )}
          <p className="text-[13px] text-muted-foreground">{relativeTime}</p>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2">
          {/* Join / leave */}
          <button
            onClick={() => isAttending ? onLeave(raid.id) : onJoin(raid.id)}
            className={`flex-1 py-2 rounded-lg text-[14px] font-semibold border transition-colors ${
              isAttending
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-card-foreground border-border'
            }`}
          >
            {isAttending ? t('leaveButton') : t('joinButton')}
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="border border-border rounded-lg px-3 py-2 text-muted-foreground"
            aria-label={t('shareButton')}
          >
            {shared ? <Check size={18} className="text-primary" /> : <Share2 size={18} />}
          </button>

          {/* Expand attendees */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="border border-border rounded-lg px-3 py-2 text-muted-foreground"
            aria-label={expanded ? t('collapseAttendees') : t('expandAttendees')}
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        {/* Attendee count */}
        <p className="text-[13px] text-muted-foreground">
          {attendeeCount > 0 ? t('attendees', { count: attendeeCount }) : t('attendeesNone')}
        </p>

        {/* Expanded: attendee names + note */}
        {expanded && (
          <div className="flex flex-col gap-2 pt-1 border-t border-border">
            {attendeeCount > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {raid.raid_attendees.map(a => (
                  <span
                    key={a.user_id}
                    className="bg-muted text-muted-foreground text-[12px] rounded-full px-2.5 py-1"
                  >
                    {a.profiles?.trainer_name ?? '—'}
                  </span>
                ))}
              </div>
            )}
            {raid.note && (
              <p className="text-[13px] text-card-foreground leading-snug">{raid.note}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
