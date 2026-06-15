'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePresence } from '@/lib/profile/use-presence';
import { useChannelUnread, type UnreadCounts } from '@/lib/chat/use-channel-unread';
import { useChannelListTyping } from '@/lib/chat/use-channel-list-typing';
import { useDMListRealtime } from '@/lib/dm/use-dm-list-realtime';
import { useDMListTyping } from '@/lib/dm/use-dm-list-typing';
import { AppHeader } from '@/components/AppHeader';
import { OnlineStrip, type OnlineStripProfile } from './OnlineStrip';
import { TypingDots } from './TypingDots';
import { DMRow, type DMRowEntry } from './DMRow';
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
  // Slice 17 — DM section feed.
  dmEntries: DMRowEntry[];
}

// Root component for /chat. Online strip + channel rows + DM rows.
export function ChannelListScreen({
  entries,
  profiles,
  totalMembers,
  currentUserId,
  initialUnreadCounts,
  dmEntries,
}: ChannelListScreenProps) {
  const t = useTranslations('Chat');
  const router = useRouter();
  const onlineIds = usePresence(currentUserId);
  const { counts, clearChannel, latestByChannel } = useChannelUnread({
    userId: currentUserId,
    initialCounts: initialUnreadCounts,
  });
  const typingByChannel = useChannelListTyping(currentUserId);
  const { latestByPartner, unreadByPartner } = useDMListRealtime({
    userId: currentUserId,
  });

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) map.set(p.user_id, p.trainer_name);
    return map;
  }, [profiles]);
  const now = new Date();

  // Merge realtime DM previews + bump unread for live arrivals. Sorting is
  // recomputed by most-recent-message timestamp.
  const liveDmEntries = useMemo(() => {
    const map = new Map<string, DMRowEntry>();
    for (const e of dmEntries) map.set(e.partnerId, e);
    for (const [partnerId, live] of Object.entries(latestByPartner)) {
      if (!live) continue;
      const existing = map.get(partnerId);
      const partnerProfile = profiles.find((p) => p.user_id === partnerId);
      const partner = existing?.partner
        ? existing.partner
        : partnerProfile
          ? {
              user_id: partnerProfile.user_id,
              trainer_name: partnerProfile.trainer_name,
              avatar_url: partnerProfile.avatar_url,
              team: partnerProfile.team ?? null,
              level: partnerProfile.level,
              last_seen_at: null,
            }
          : null;
      const baseUnread = existing?.unread ?? 0;
      // Unread = server baseline + every message seen live since mount. The
      // live count is accumulated per-partner by useDMListRealtime (not derived
      // from `latestByPartner`, which only holds the newest message) so the
      // badge keeps climbing per message and tracks the BottomNav total.
      const liveUnread = unreadByPartner[partnerId] ?? 0;
      // Show the live message as the preview only when it's newer than what we
      // already had (the SSR baseline).
      const incomingNewer =
        !existing?.lastMessage ||
        new Date(live.created_at).getTime() >
          new Date(existing.lastMessage.created_at).getTime();
      map.set(partnerId, {
        partnerId,
        partner,
        lastMessage: incomingNewer
          ? {
              body: live.body,
              created_at: live.created_at,
              sender_id: live.sender_id,
            }
          : existing!.lastMessage,
        unread: baseUnread + liveUnread,
      });
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.lastMessage?.created_at ?? 0).getTime() -
        new Date(a.lastMessage?.created_at ?? 0).getTime()
    );
  }, [dmEntries, latestByPartner, unreadByPartner, profiles]);

  const dmPartnerIds = useMemo(
    () => liveDmEntries.map((e) => e.partnerId),
    [liveDmEntries]
  );
  const typingPartners = useDMListTyping(currentUserId, dmPartnerIds);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile: branded header (icon + wordmark + large title). */}
      <div className="lg:hidden">
        <AppHeader title={t('listTitle')} />
      </div>

      {/* Desktop: the sidebar (DesktopShell) brands the screen — keep the simple header. */}
      <div className="hidden lg:flex fixed top-0 left-0 right-0 z-10 bg-card border-b border-border px-4 h-[60px] items-center">
        <h1 className="text-[18px] font-bold text-card-foreground">{t('listTitle')}</h1>
      </div>

      <main className="pt-[116px] lg:pt-[76px] pb-[80px] px-3 flex flex-col gap-5">
        <OnlineStrip
          profiles={profiles}
          onlineIds={onlineIds}
          totalMembers={totalMembers}
          currentUserId={currentUserId}
          onAvatarTap={(partnerId) => router.push(`/chat/dm/${partnerId}`)}
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
              const live = latestByChannel[channel.id];
              const livePreview =
                live &&
                (!lastMessage ||
                  new Date(live.created_at).getTime() > new Date(lastMessage.created_at).getTime())
                  ? {
                      body: live.body,
                      created_at: live.created_at,
                      author_name: nameById.get(live.user_id) ?? null,
                      author_is_me: live.user_id === currentUserId,
                    }
                  : lastMessage;
              return (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  lastMessage={livePreview}
                  now={now}
                  unread={counts[channel.id]}
                  onOpen={() => clearChannel(channel.id)}
                  typingNames={typingNames}
                />
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <div className="flex justify-between items-baseline px-1 gap-2">
            <span className="text-[13px] font-bold text-card-foreground uppercase tracking-wider whitespace-nowrap">
              {t('dmSectionTitle')}
            </span>
            {liveDmEntries.length > 0 && (
              <span className="text-[12px] font-semibold text-muted-foreground whitespace-nowrap">
                {t('dmConversations', { n: liveDmEntries.length })}
              </span>
            )}
          </div>
          {liveDmEntries.length === 0 ? (
            <div className="flex flex-col gap-1 px-1">
              <p className="text-[13px] text-muted-foreground italic">
                {t('dmSectionEmpty')}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {t('dmSectionHint')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {liveDmEntries.map((entry) => (
                <DMRow
                  key={entry.partnerId}
                  entry={entry}
                  online={onlineIds.has(entry.partnerId)}
                  isMineLast={entry.lastMessage?.sender_id === currentUserId}
                  typing={typingPartners.has(entry.partnerId)}
                  onOpen={() => {
                    /* unread is cleared server-side on DM page render */
                  }}
                  now={now}
                />
              ))}
            </div>
          )}
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
