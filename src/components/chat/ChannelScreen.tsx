'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { usePresence } from '@/lib/profile/use-presence';
import { useChannelRealtime } from '@/lib/chat/use-channel-realtime';
import { sendMessage, type ChannelMessageRow } from '@/lib/chat/helpers';
import {
  daySeparator,
  groupMessages,
  type MessageGroup as MessageGroupType,
} from '@/lib/chat/time';
import type { Channel } from '@/lib/chat/channels';
import type { ChannelMessage } from '@/lib/chat/server-helpers';
import type { OnlineStripProfile } from './OnlineStrip';
import { Composer } from './Composer';
import { MembersSheet } from './MembersSheet';
import { MessageGroupView } from './MessageGroup';
import { TypingDots } from './TypingDots';

// Shape consumed by MessageGroupView — sent_at is a Date for the grouping helper.
export interface ChatMessage {
  id: string;
  author_id: string;
  body: string;
  sent_at: Date;
  profiles: {
    trainer_name: string;
    avatar_url: string | null;
    team: 'mystic' | 'valor' | 'instinct' | null;
    level: number | null;
  } | null;
}

interface ChannelScreenProps {
  channel: Channel;
  initialMessages: ChannelMessage[];
  profiles: OnlineStripProfile[];
  memberCount: number;
  currentUserId: string;
  currentUserName: string;
}

// Convert server row → client message with Date `sent_at`.
function toChatMessage(row: ChannelMessage): ChatMessage {
  return {
    id: row.id,
    author_id: row.user_id,
    body: row.body,
    sent_at: new Date(row.created_at),
    profiles: row.profiles,
  };
}

// Root for /chat/[channelId]. Header + reverse-stacked message list + composer.
export function ChannelScreen({
  channel,
  initialMessages,
  profiles,
  memberCount,
  currentUserId,
  currentUserName,
}: ChannelScreenProps) {
  const router = useRouter();
  const t = useTranslations('Chat');

  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages.map(toChatMessage)
  );
  const [membersOpen, setMembersOpen] = useState(false);

  const onlineIds = usePresence(currentUserId);

  // Resolve a profile blob for messages whose row doesn't have one embedded
  // (Realtime INSERTs don't carry the join).
  const profileById = useMemo(() => {
    const map = new Map<string, OnlineStripProfile>();
    for (const p of profiles) map.set(p.user_id, p);
    return map;
  }, [profiles]);

  const { typingUserIds, broadcastTyping } = useChannelRealtime(
    channel.id,
    currentUserId,
    (row: ChannelMessageRow) => {
      const profile = profileById.get(row.user_id);
      const msg: ChatMessage = {
        id: row.id,
        author_id: row.user_id,
        body: row.body,
        sent_at: new Date(row.created_at),
        profiles: profile
          ? {
              trainer_name: profile.trainer_name,
              avatar_url: profile.avatar_url,
              team: profile.team,
              level: profile.level,
            }
          : null,
      };
      setMessages((prev) => {
        // Replace optimistic placeholder from this sender, if any.
        if (prev.some((m) => m.id.startsWith('opt-') && m.author_id === row.user_id)) {
          return prev.map((m) =>
            m.id.startsWith('opt-') && m.author_id === row.user_id ? msg : m
          );
        }
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, msg];
      });
    }
  );

  async function handleSend(body: string) {
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      author_id: currentUserId,
      body,
      sent_at: new Date(),
      profiles: {
        trainer_name: currentUserName,
        avatar_url: profileById.get(currentUserId)?.avatar_url ?? null,
        team: profileById.get(currentUserId)?.team ?? null,
        level: profileById.get(currentUserId)?.level ?? null,
      },
    };
    setMessages((prev) => [...prev, optimistic]);
    await sendMessage(channel.id, currentUserId, body);
  }

  // Build the visual row list — day separators between groups whose first
  // message crosses a calendar day boundary from the previous group.
  const rows = useMemo(() => {
    const groups = groupMessages(messages);
    let lastOwnGroupIdx = -1;
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i].author_id === currentUserId) {
        lastOwnGroupIdx = i;
        break;
      }
    }
    const lastGroupIsMine =
      groups.length > 0 && groups[groups.length - 1].author_id === currentUserId;

    const out: Array<
      | { kind: 'sep'; key: string; label: string }
      | {
          kind: 'group';
          key: string;
          group: MessageGroupType<ChatMessage>;
          mine: boolean;
          isLastOwnGroup: boolean;
        }
    > = [];
    let prevDayKey: string | null = null;
    const now = new Date();
    groups.forEach((g, gi) => {
      const dayKey = new Date(g.messages[0].sent_at).toDateString();
      if (dayKey !== prevDayKey) {
        out.push({
          kind: 'sep',
          key: `sep-${dayKey}`,
          label: daySeparator(g.messages[0].sent_at, now),
        });
        prevDayKey = dayKey;
      }
      out.push({
        kind: 'group',
        key: `g-${gi}`,
        group: g,
        mine: g.author_id === currentUserId,
        isLastOwnGroup: gi === lastOwnGroupIdx && lastGroupIsMine,
      });
    });
    return out;
  }, [messages, currentUserId]);

  // column-reverse pins to the bottom by default — the FIRST DOM child becomes
  // the visual bottom, so the rows must be reversed and the welcome banner
  // (visually on top) sits at the END.
  const reversedRows = [...rows].reverse();

  const onlineMembers = profiles.filter((p) => onlineIds.has(p.user_id));
  const headerStack = onlineMembers.slice(0, 3);
  const typingNames = Array.from(typingUserIds)
    .map((id) => profileById.get(id)?.trainer_name)
    .filter((n): n is string => Boolean(n));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-card border-b border-border h-[60px] flex items-center gap-2 px-2">
        <button
          type="button"
          onClick={() => router.push('/chat')}
          aria-label={t('back')}
          className="w-10 h-10 rounded-full flex items-center justify-center text-card-foreground"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-baseline gap-1">
            <span className="text-[13px] font-bold text-muted-foreground">#</span>
            <span className="text-[17px] font-bold text-card-foreground">
              {channel.name}
            </span>
          </div>
          <div className="text-[12px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
            {t('headerOnline', { online: onlineMembers.length, total: memberCount })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMembersOpen(true)}
          aria-label={t('members')}
          className="flex items-center pl-2 pr-1.5 py-1 rounded-full"
        >
          <div className="flex">
            {headerStack.map((p, i) => (
              <div key={p.user_id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                <Avatar
                  src={p.avatar_url}
                  name={p.trainer_name}
                  team={p.team ?? 'none'}
                  size={28}
                  ring
                  ringWidth={2}
                />
              </div>
            ))}
          </div>
        </button>
      </div>

      {/* Message list — column-reverse pins to bottom */}
      <main className="fixed left-0 right-0 top-[60px] bottom-[70px] overflow-y-auto px-3 pt-2.5 pb-1.5 flex flex-col-reverse">
        {typingNames.length > 0 && (
          <div className="flex gap-2 mt-2">
            <div className="w-8 shrink-0" />
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-muted-foreground px-1 whitespace-nowrap">
                {typingNames.length === 1
                  ? t('typingOne', { name: typingNames[0] })
                  : typingNames.length === 2
                    ? t('typingTwo', { a: typingNames[0], b: typingNames[1] })
                    : t('typingMany', { n: typingNames.length })}
              </span>
              <div className="bg-input px-3.5 py-3 rounded-2xl self-start">
                <TypingDots size={6} className="text-muted-foreground" />
              </div>
            </div>
          </div>
        )}

        {reversedRows.map((row) => {
          if (row.kind === 'sep') {
            return (
              <div key={row.key} className="flex items-center gap-2.5 mt-3.5 mb-1.5 mx-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                  {row.label}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            );
          }
          return (
            <MessageGroupView
              key={row.key}
              group={row.group}
              mine={row.mine}
              isLastOwnGroup={row.isLastOwnGroup}
            />
          );
        })}

        {/* Welcome banner — last DOM child = visual top in column-reverse */}
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1.5 my-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center">
              <span className="text-[20px] font-extrabold text-primary leading-none">#</span>
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-card-foreground">
                {t('welcomeTo', { channel: channel.name })}
              </div>
              <div className="text-[12px] font-semibold text-muted-foreground">
                {t('memberCount', { n: memberCount })}
              </div>
            </div>
          </div>
          <p className="text-[13px] text-card-foreground leading-snug">{channel.description}</p>
        </div>
      </main>

      <Composer
        channelName={channel.name}
        onSend={handleSend}
        onTyping={broadcastTyping}
      />

      <MembersSheet
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        profiles={profiles}
        onlineIds={onlineIds}
        currentUserId={currentUserId}
      />
    </div>
  );
}
