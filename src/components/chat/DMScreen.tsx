'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/Avatar';
import { usePresence } from '@/lib/profile/use-presence';
import { track } from '@/lib/analytics/amplitude';
import { useDMRealtime } from '@/lib/dm/use-dm-realtime';
import { useDMReactionsRealtime } from '@/lib/dm/use-dm-reactions-realtime';
import { sendDM, type DirectMessageRow } from '@/lib/dm/helpers';
import {
  groupReactions,
  toggleReaction,
  type DMReactionRow,
} from '@/lib/dm/reactions-helpers';
import {
  daySeparator,
  groupMessages,
  type MessageGroup as MessageGroupType,
} from '@/lib/chat/time';
import type { DirectMessage, DMProfile } from '@/lib/dm/server-helpers';
import type { ChatMessage } from '@/lib/chat/types';
import type { OnlineStripProfile } from './OnlineStrip';
import { Composer } from './Composer';
import { DMHeader } from './DMHeader';
import { MessageActionSheet } from './MessageActionSheet';
import { MessageGroupView } from './MessageGroup';
import { TypingDots } from './TypingDots';

interface DMScreenProps {
  partner: DMProfile;
  initialMessages: DirectMessage[];
  profiles: OnlineStripProfile[];
  currentUserId: string;
  currentUserName: string;
}

// Convert a server DirectMessage → shared ChatMessage. Maps sender_id to
// author_id at the boundary so MessageGroupView / ReplyQuote / Reactions all
// work without DM-specific changes.
function toChatMessage(row: DirectMessage, partner: DMProfile, me: { user_id: string; trainer_name: string; avatar_url: string | null; team: 'mystic' | 'valor' | 'instinct' | null; level: number | null } | null): ChatMessage {
  const reactionRows = (row.reactions ?? []).map((r) => ({
    message_id: row.id,
    user_id: r.user_id,
    emoji: r.emoji,
  }));
  // The DM page only has two participants — prefer the embedded sender profile
  // when present, otherwise fall back to the resolved partner/me blob.
  const isFromPartner = row.sender_id === partner.user_id;
  const profile = row.sender
    ? {
        trainer_name: row.sender.trainer_name,
        avatar_url: row.sender.avatar_url,
        team: isFromPartner ? partner.team : me?.team ?? null,
        level: isFromPartner ? partner.level : me?.level ?? null,
      }
    : isFromPartner
      ? {
          trainer_name: partner.trainer_name,
          avatar_url: partner.avatar_url,
          team: partner.team,
          level: partner.level,
        }
      : me
        ? {
            trainer_name: me.trainer_name,
            avatar_url: me.avatar_url,
            team: me.team,
            level: me.level,
          }
        : null;
  return {
    id: row.id,
    author_id: row.sender_id,
    body: row.body,
    sent_at: new Date(row.created_at),
    reply_to_id: row.reply_to_id,
    reactions: groupReactions(reactionRows),
    profiles: profile,
  };
}

// Root for /chat/dm/[partnerId]. Header + reverse-stacked message stream + composer.
// Mirrors ChannelScreen.tsx structurally — same MessageGroupView, Composer, and
// MessageActionSheet, but wired to direct_messages instead of channel_messages.
export function DMScreen({
  partner,
  initialMessages,
  profiles,
  currentUserId,
  currentUserName,
}: DMScreenProps) {
  const t = useTranslations('Chat');

  const profileById = useMemo(() => {
    const map = new Map<string, OnlineStripProfile>();
    for (const p of profiles) map.set(p.user_id, p);
    return map;
  }, [profiles]);
  const me = profileById.get(currentUserId)
    ? { ...profileById.get(currentUserId)!, trainer_name: currentUserName }
    : null;

  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages.map((m) => toChatMessage(m, partner, me))
  );

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [actionMsgId, setActionMsgId] = useState<string | null>(null);
  const [reactionOverrides, setReactionOverrides] = useState<
    Record<string, Record<string, string[]>>
  >({});

  const onlineIds = usePresence(currentUserId);
  const partnerOnline = onlineIds.has(partner.user_id);

  const { typingUserIds, broadcastTyping } = useDMRealtime(
    currentUserId,
    partner.user_id,
    (row: DirectMessageRow) => {
      // Only the partner's messages arrive via realtime (self-sent reconcile
      // through optimistic state).
      const msg: ChatMessage = {
        id: row.id,
        author_id: row.sender_id,
        body: row.body,
        sent_at: new Date(row.created_at),
        reply_to_id: row.reply_to_id ?? null,
        reactions: {},
        profiles: {
          trainer_name: partner.trainer_name,
          avatar_url: partner.avatar_url,
          team: partner.team,
          level: partner.level,
        },
      };
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, msg];
      });
    }
  );

  const displayedMessages = useMemo(
    () =>
      messages.map((m) => {
        const override = reactionOverrides[m.id];
        return override !== undefined ? { ...m, reactions: override } : m;
      }),
    [messages, reactionOverrides]
  );

  const messagesById = useMemo(() => {
    const map: Record<string, ChatMessage> = {};
    for (const m of displayedMessages) map[m.id] = m;
    return map;
  }, [displayedMessages]);

  const messageIdSet = useMemo(
    () => new Set(messages.map((m) => m.id)),
    [messages]
  );

  const applyReactionDelta = useCallback(
    (
      messageId: string,
      emoji: string,
      userId: string,
      kind: 'add' | 'remove'
    ) => {
      setReactionOverrides((prev) => {
        const sourceMsg = messages.find((m) => m.id === messageId);
        const base =
          prev[messageId] ??
          (sourceMsg ? sourceMsg.reactions : ({} as Record<string, string[]>));
        const list = base[emoji] ?? [];
        let nextList: string[];
        if (kind === 'add') {
          if (list.includes(userId)) return prev;
          nextList = [...list, userId];
        } else {
          if (!list.includes(userId)) return prev;
          nextList = list.filter((id) => id !== userId);
        }
        const next = { ...base };
        if (nextList.length === 0) delete next[emoji];
        else next[emoji] = nextList;
        return { ...prev, [messageId]: next };
      });
    },
    [messages]
  );

  const reactionCallbacks = useMemo(
    () => ({
      onInsert: (row: DMReactionRow) =>
        applyReactionDelta(row.message_id, row.emoji, row.user_id, 'add'),
      onDelete: (row: DMReactionRow) =>
        applyReactionDelta(row.message_id, row.emoji, row.user_id, 'remove'),
    }),
    [applyReactionDelta]
  );

  useDMReactionsRealtime(
    currentUserId,
    partner.user_id,
    messageIdSet,
    reactionCallbacks
  );

  async function handleSend(body: string) {
    const replyId = replyTo?.id ?? null;
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      author_id: currentUserId,
      body,
      sent_at: new Date(),
      reply_to_id: replyId,
      reactions: {},
      profiles: {
        trainer_name: currentUserName,
        avatar_url: me?.avatar_url ?? null,
        team: me?.team ?? null,
        level: me?.level ?? null,
      },
    };
    setMessages((prev) => [...prev, optimistic]);
    setReplyTo(null);
    // Analytics: DM sent. No recipient id or body — fully anonymous.
    track('dm_sent');
    await sendDM(currentUserId, partner.user_id, body, replyId);
  }

  function handleMessageTap(message: ChatMessage) {
    if (message.id.startsWith('opt-')) return;
    setActionMsgId(message.id);
  }

  function handleReactToggle(messageId: string, emoji: string) {
    const sourceMsg = messages.find((m) => m.id === messageId);
    if (!sourceMsg || messageId.startsWith('opt-')) return;
    const currentList =
      reactionOverrides[messageId]?.[emoji] ??
      sourceMsg.reactions[emoji] ??
      [];
    const has = currentList.includes(currentUserId);
    // Analytics: only count newly-added reactions (not removals). Surface only.
    if (!has) track('reaction_added', { surface: 'dm' });
    applyReactionDelta(
      messageId,
      emoji,
      currentUserId,
      has ? 'remove' : 'add'
    );
    void toggleReaction(messageId, currentUserId, emoji);
  }

  function handleSheetReact(emoji: string) {
    if (actionMsgId) handleReactToggle(actionMsgId, emoji);
    setActionMsgId(null);
  }

  function handleSheetReply() {
    if (actionMsgId) {
      const target = messagesById[actionMsgId];
      if (target) setReplyTo(target);
    }
    setActionMsgId(null);
  }

  function handleSheetCopy() {
    if (!actionMsgId) return;
    const target = messagesById[actionMsgId];
    if (target && typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(target.body);
    }
    setActionMsgId(null);
  }

  const rows = useMemo(() => {
    const groups = groupMessages(displayedMessages);
    let lastOwnGroupIdx = -1;
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i].author_id === currentUserId) {
        lastOwnGroupIdx = i;
        break;
      }
    }
    const lastGroupIsMine =
      groups.length > 0 &&
      groups[groups.length - 1].author_id === currentUserId;

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
  }, [displayedMessages, currentUserId]);

  const reversedRows = [...rows].reverse();

  // Only the partner's typing matters in a 1:1 thread; the hook already filters
  // out the current user.
  const partnerTyping = typingUserIds.has(partner.user_id);

  const replyToName = replyTo
    ? replyTo.author_id === currentUserId
      ? t('you_lowercase')
      : replyTo.profiles?.trainer_name ?? ''
    : '';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DMHeader partner={partner} online={partnerOnline} />

      <main className="fixed left-0 right-0 top-[60px] bottom-[70px] overflow-y-auto px-3 pt-2.5 pb-1.5 flex flex-col-reverse">
        {partnerTyping && (
          <div className="flex gap-2 mt-2">
            <div className="w-8 shrink-0" />
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-muted-foreground px-1 whitespace-nowrap">
                {t('typingOne', { name: partner.trainer_name })}
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
              <div
                key={row.key}
                className="flex items-center gap-2.5 mt-3.5 mb-1.5 mx-1"
              >
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
              messagesById={messagesById}
              currentUserId={currentUserId}
              highlightedId={actionMsgId}
              onTap={handleMessageTap}
              onReactToggle={handleReactToggle}
            />
          );
        })}

        {/* Intro card — last DOM child = visual top in column-reverse */}
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1.5 my-2.5">
          <div className="flex items-center gap-2.5">
            <Avatar
              src={partner.avatar_url}
              name={partner.trainer_name}
              team={partner.team ?? 'none'}
              size={40}
              ring={false}
            />
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-card-foreground truncate">
                {partner.trainer_name}
              </div>
              <div className="text-[12px] font-semibold text-muted-foreground">
                {t('dmIntroLine')}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Composer
        channelName={partner.trainer_name}
        onSend={handleSend}
        onTyping={broadcastTyping}
        replyTo={replyTo}
        replyToName={replyToName}
        onCancelReply={() => setReplyTo(null)}
      />

      <MessageActionSheet
        message={actionMsgId ? messagesById[actionMsgId] ?? null : null}
        currentUserId={currentUserId}
        onClose={() => setActionMsgId(null)}
        onReact={handleSheetReact}
        onReply={handleSheetReply}
        onCopy={handleSheetCopy}
      />
    </div>
  );
}
