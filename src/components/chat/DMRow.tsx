'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/Avatar';
import { relTime } from '@/lib/chat/time';
import { TypingDots } from './TypingDots';
import type { DMProfile } from '@/lib/dm/server-helpers';

export interface DMRowEntry {
  partnerId: string;
  partner: DMProfile | null;
  lastMessage: {
    body: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread: number;
}

interface DMRowProps {
  entry: DMRowEntry;
  online: boolean;
  isMineLast: boolean;
  typing: boolean;
  onOpen: () => void;
  now: Date;
}

// Single conversation row on the /chat DM list — avatar + name + last-message
// preview + relative time + unread badge + typing indicator.
//
// Preview prefix: "Du: ..." when the last message was sent by the current user,
// "<trainer_name>: ..." otherwise.
export function DMRow({ entry, online, isMineLast, typing, onOpen, now }: DMRowProps) {
  const t = useTranslations('Chat');
  const hasUnread = entry.unread > 0;
  const name = entry.partner?.trainer_name ?? '—';

  return (
    <Link
      href={`/chat/dm/${entry.partnerId}`}
      onClick={onOpen}
      className="flex gap-3 items-start bg-card border border-border rounded-lg p-3.5 text-left"
    >
      <div className="shrink-0">
        <Avatar
          src={entry.partner?.avatar_url ?? null}
          name={name}
          team={entry.partner?.team ?? 'none'}
          size={44}
          online={online}
          ring={false}
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-[15px] font-bold text-card-foreground truncate">
            {name}
          </span>
          {entry.lastMessage && (
            <span
              className={`text-[12px] font-semibold shrink-0 whitespace-nowrap ${
                hasUnread ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {relTime(new Date(entry.lastMessage.created_at), now)}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center gap-2">
          <div className="flex-1 min-w-0 overflow-hidden">
            {typing ? (
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold italic text-primary truncate max-w-full">
                <TypingDots size={5} className="text-primary" />
                <span className="truncate">{t('dmTypingShort')}</span>
              </span>
            ) : entry.lastMessage ? (
              <p
                className={`text-[13px] truncate ${
                  hasUnread ? 'text-card-foreground font-semibold' : 'text-muted-foreground'
                }`}
              >
                <span className="font-semibold text-card-foreground">
                  {isMineLast ? t('you_short') : name}:
                </span>{' '}
                {entry.lastMessage.body}
              </p>
            ) : (
              <p className="text-[13px] italic text-muted-foreground">
                {t('noMessages')}
              </p>
            )}
          </div>
          {hasUnread && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold inline-flex items-center justify-center shrink-0">
              {entry.unread}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
