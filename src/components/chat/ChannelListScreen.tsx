'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePresence } from '@/lib/profile/use-presence';
import { useChannelUnread, type UnreadCounts } from '@/lib/chat/use-channel-unread';
import { useChannelListTyping } from '@/lib/chat/use-channel-list-typing';
import { OnlineStrip, type OnlineStripProfile } from './OnlineStrip';
import { TypingDots } from './TypingDots';
import { relTime } from '@/lib/chat/time';
import type { Channel } from '@/lib/chat/channels';

export interface ChannelListEntry {
  channel: Channel;
  lastMessage: {
    body: string;
    created_at: string;
    author_name: string | null;
    author_is_me: boolean;
  } | null;
}

interface ChannelListScreenProps {
  entries: ChannelListEntry[];
  profiles: OnlineStripProfile[];
  totalMembers: number;
  currentUserId: string;
  initialUnreadCounts: UnreadCounts;
}

// Root component for /chat. Online strip + channel rows.
// DMs deferred (Phase 2) — no DM section rendered.
export function ChannelListScreen({
  entries,
  profiles,
  totalMembers,
  currentUserId,
  initialUnreadCounts,
}: ChannelListScreenProps) {
  const t = useTranslations('Chat');
  const onlineIds = usePresence(currentUserId);
  const { counts, clearChannel } = useChannelUnread({
    userId: currentUserId,
    initialCounts: initialUnreadCounts,
  });
  const typingByChannel = useChannelListTyping(currentUserId);
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) map.set(p.user_id, p.trainer_name);
    return map;
  }, [profiles]);
  const now = new Date();

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 left-0 right-0 z-10 bg-card border-b border-border px-4 h-[60px] flex items-center">
        <h1 className="text-[18px] font-bold text-card-foreground">{t('listTitle')}</h1>
      </div>

      <main className="pt-[76px] pb-[80px] px-3 flex flex-col gap-5">
        <OnlineStrip
          profiles={profiles}
          onlineIds={onlineIds}
          totalMembers={totalMembers}
          currentUserId={currentUserId}
        />

        <section className="flex flex-col gap-2.5">
          <div className="flex justify-end items-baseline px-1">
            <span className="text-[12px] font-semibold text-muted-foreground whitespace-nowrap">
              {t('kanaler', { n: entries.length })}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {entries.map(({ channel, lastMessage }) => {
              const typingIds = Array.from(typingByChannel[channel.id]);
              const typingNames = typingIds
                .map((id) => nameById.get(id))
                .filter((n): n is string => Boolean(n));
              return (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  lastMessage={lastMessage}
                  now={now}
                  unread={counts[channel.id]}
                  onOpen={() => clearChannel(channel.id)}
                  typingNames={typingNames}
                />
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

interface ChannelRowProps {
  channel: Channel;
  lastMessage: ChannelListEntry['lastMessage'];
  now: Date;
  unread: number;
  onOpen: () => void;
  typingNames: string[];
}

function ChannelRow({ channel, lastMessage, now, unread, onOpen, typingNames }: ChannelRowProps) {
  const t = useTranslations('Chat');
  const hasUnread = unread > 0;
  const isTyping = typingNames.length > 0;

  // Typing preview takes priority over last-message — matches the design.
  let typingSentence = '';
  if (isTyping) {
    if (typingNames.length === 1) {
      typingSentence = t('typingOne', { name: typingNames[0] });
    } else if (typingNames.length === 2) {
      typingSentence = t('typingTwo', { a: typingNames[0], b: typingNames[1] });
    } else {
      typingSentence = t('typingMany', { n: typingNames.length });
    }
  }

  return (
    <Link
      href={`/chat/${channel.id}`}
      onClick={onOpen}
      className="flex gap-3 items-start bg-card border border-border rounded-lg p-3.5 text-left"
    >
      <div className="w-11 h-11 rounded-md bg-secondary flex items-center justify-center shrink-0">
        <span className="text-[22px] font-extrabold text-primary leading-none">#</span>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-[15px] font-bold text-card-foreground whitespace-nowrap">
            {channel.name}
          </span>
          {lastMessage && (
            <span
              className={`text-[12px] font-semibold shrink-0 whitespace-nowrap ${
                hasUnread ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {relTime(new Date(lastMessage.created_at), now)}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center gap-2">
          <div className="flex-1 min-w-0 overflow-hidden">
            {isTyping ? (
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold italic text-primary truncate max-w-full">
                <TypingDots size={5} className="text-primary" />
                <span className="truncate">{typingSentence}</span>
              </span>
            ) : lastMessage ? (
              <p
                className={`text-[13px] truncate ${
                  hasUnread ? 'text-card-foreground font-semibold' : 'text-muted-foreground'
                }`}
              >
                <span className="font-semibold text-card-foreground">
                  {lastMessage.author_is_me ? t('you_short') : (lastMessage.author_name ?? '—')}:
                </span>{' '}
                {lastMessage.body}
              </p>
            ) : (
              <p className="text-[13px] italic text-muted-foreground">{t('noMessages')}</p>
            )}
          </div>
          {hasUnread && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold inline-flex items-center justify-center shrink-0">
              {unread}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

