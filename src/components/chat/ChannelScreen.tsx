'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { usePresence } from '@/lib/profile/use-presence';
import { track } from '@/lib/analytics/amplitude';
import { createClient } from '@/lib/supabase/client';
import { useChannelRealtime } from '@/lib/chat/use-channel-realtime';
import { useChannelReactionsRealtime } from '@/lib/chat/use-channel-reactions-realtime';
import { isQaChannel } from '@/lib/pogo-qa/types';
import { looksLikeQuestion, parseQuestion } from '@/lib/pogo-qa/trigger';
import {
  sendMessage,
  type ChannelMessageRow,
} from '@/lib/chat/helpers';
import {
  groupReactions,
  toggleReaction,
  type ChannelReactionRow,
} from '@/lib/chat/reactions-helpers';
import {
  daySeparator,
  groupMessages,
  type MessageGroup as MessageGroupType,
} from '@/lib/chat/time';
import type { Channel } from '@/lib/chat/channels';
import type { ChannelMessage } from '@/lib/chat/server-helpers';
import type { ChatMessage } from '@/lib/chat/types';
import type { OnlineStripProfile } from './OnlineStrip';
import { Composer } from './Composer';
import { MembersSheet } from './MembersSheet';
import { MessageActionSheet } from './MessageActionSheet';
import { MessageGroupView } from './MessageGroup';
import { ReportSheet } from './ReportSheet';
import { TypingDots } from './TypingDots';

// Re-exported for backward compatibility — the type lives in `@/lib/chat/types`
// so both channel chat and raid chat can consume it without circular imports.
export type { ChatMessage };

// ---------------------------------------------------------------------------
// Q&A bot (!pogo) — see src/lib/pogo-qa/ and docs/plans/pogo-qa-bot.md.
// ---------------------------------------------------------------------------

// Per-device acknowledgement that a !pogo question leaves the EU and reaches
// Anthropic. Deliberately localStorage rather than a profile column: it is an
// explainer, not a legal consent record, and the same per-device idiom the
// live-location share explainer uses. Privacy Policy §15 is the durable text.
const BOT_CONSENT_KEY = 'pogosundet:bot-consent';

// How often to re-broadcast "the bot is typing" while /api/bot/ask is in
// flight. Must stay under TYPING_IDLE_MS (3000) in use-channel-realtime.ts, or
// the indicator blinks off between beats.
const BOT_TYPING_BEAT_MS = 2000;

/** Has this device seen the bot explainer? Never throws — see acceptBotConsent. */
function hasBotConsent(): boolean {
  try {
    return window.localStorage.getItem(BOT_CONSENT_KEY) === '1';
  } catch {
    // Private mode or storage disabled. Falling back to "not yet acknowledged"
    // re-shows the explainer, which is a harmless outcome for an explainer.
    return false;
  }
}

/** Which inline notice to show above the composer, if any. */
type BotNotice = 'rate_limited' | 'unavailable' | 'failed' | 'send_failed';

interface ChannelScreenProps {
  channel: Channel;
  initialMessages: ChannelMessage[];
  profiles: OnlineStripProfile[];
  // Bot authors. Used ONLY to resolve a message's display name/avatar — kept out
  // of `profiles` so bots never appear in the online strip or members sheet.
  botProfiles?: OnlineStripProfile[];
  memberCount: number;
  currentUserId: string;
  currentUserName: string;
}

// Convert server row → client message with Date `sent_at` and grouped reactions.
// The embedded reactions list omits message_id (it IS the parent row); we add
// it back so groupReactions has a uniform input shape.
function toChatMessage(row: ChannelMessage): ChatMessage {
  const reactionRows = (row.reactions ?? []).map((r) => ({
    message_id: row.id,
    user_id: r.user_id,
    emoji: r.emoji,
  }));
  return {
    id: row.id,
    author_id: row.user_id,
    body: row.body,
    sent_at: new Date(row.created_at),
    reply_to_id: row.reply_to_id,
    reactions: groupReactions(reactionRows),
    profiles: row.profiles,
  };
}

// Root for /chat/[channelId]. Header + reverse-stacked message list + composer.
export function ChannelScreen({
  channel,
  initialMessages,
  profiles,
  botProfiles,
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

  // Reply / action-sheet state — slice 13.
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [actionMsgId, setActionMsgId] = useState<string | null>(null);
  // Message currently being reported — drives ReportSheet. Held separately
  // from actionMsgId because the action sheet closes as the report sheet opens.
  const [reportMsgId, setReportMsgId] = useState<string | null>(null);
  // Sparse overlay: messageId → grouped reactions. Wins over messages[i].reactions
  // when present. Set via realtime + optimistic toggles.
  const [reactionOverrides, setReactionOverrides] = useState<
    Record<string, Record<string, string[]>>
  >({});

  // Q&A bot state. `botConsentBody` doubles as the open/closed flag for the
  // explainer sheet AND the holding pen for the question typed before it was
  // accepted — so accepting replays the exact text rather than asking the
  // member to retype it.
  const [botConsentBody, setBotConsentBody] = useState<string | null>(null);
  const [botNotice, setBotNotice] = useState<BotNotice | null>(null);
  const [botThinking, setBotThinking] = useState(false);
  const botBeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onlineIds = usePresence(currentUserId);

  // The bot's identity comes from botProfiles (the author-resolution list), so
  // the client never needs POGO_BOT_USER_ID. Empty when the bot account isn't
  // configured on this deployment — in which case we simply don't broadcast.
  const botUserId = botProfiles?.[0]?.user_id ?? null;
  const botName = botProfiles?.[0]?.trainer_name ?? null;

  // Clear the typing beat if the screen unmounts mid-request. askBot's `finally`
  // covers the normal and error paths; this covers navigating away.
  useEffect(() => {
    return () => {
      if (botBeatRef.current) clearInterval(botBeatRef.current);
    };
  }, []);

  // Analytics: channel opened. channel.id is the fixed channel slug (not PII).
  useEffect(() => {
    track('channel_opened', { channel: channel.id });
  }, [channel.id]);

  // Resolve a profile blob for messages whose row doesn't have one embedded
  // (Realtime INSERTs don't carry the join).
  const profileById = useMemo(() => {
    const map = new Map<string, OnlineStripProfile>();
    for (const p of profiles) map.set(p.user_id, p);
    // Bots are author-resolvable but not members, so they go into this lookup
    // only — never into the `profiles` list the strip and sheet render from.
    for (const p of botProfiles ?? []) map.set(p.user_id, p);
    return map;
  }, [profiles, botProfiles]);

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
        reply_to_id: row.reply_to_id ?? null,
        reactions: {},
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
        if (
          prev.some(
            (m) => m.id.startsWith('opt-') && m.author_id === row.user_id
          )
        ) {
          return prev.map((m) =>
            m.id.startsWith('opt-') && m.author_id === row.user_id ? msg : m
          );
        }
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, msg];
      });
    },
    // A moderator deleted this message — drop it for everyone who has the
    // channel open, without a full page refetch.
    (messageId: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  );

  // Apply overrides on top of the source messages.
  const displayedMessages = useMemo(
    () =>
      messages.map((m) => {
        const override = reactionOverrides[m.id];
        return override !== undefined ? { ...m, reactions: override } : m;
      }),
    [messages, reactionOverrides]
  );

  // Index for ReplyQuote lookups and sheet-target resolution.
  const messagesById = useMemo(() => {
    const map: Record<string, ChatMessage> = {};
    for (const m of displayedMessages) map[m.id] = m;
    return map;
  }, [displayedMessages]);

  // Live set of known message IDs — passed to the reactions realtime hook to
  // filter out events for messages we haven't loaded.
  const messageIdSet = useMemo(
    () => new Set(messages.map((m) => m.id)),
    [messages]
  );

  // Merge a single realtime/optimistic delta into reactionOverrides.
  const applyReactionDelta = useCallback(
    (
      messageId: string,
      emoji: string,
      userId: string,
      kind: 'add' | 'remove'
    ) => {
      setReactionOverrides((prev) => {
        // Base: existing override OR the source message's grouped reactions.
        const sourceMsg = messages.find((m) => m.id === messageId);
        const base =
          prev[messageId] ??
          (sourceMsg ? sourceMsg.reactions : ({} as Record<string, string[]>));
        const list = base[emoji] ?? [];
        let nextList: string[];
        if (kind === 'add') {
          if (list.includes(userId)) return prev; // no-op
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

  // Stable callbacks object for the realtime hook — it caches via ref so
  // changing identity per render is fine, but keeping it stable is cheap.
  const reactionCallbacks = useMemo(
    () => ({
      onInsert: (row: ChannelReactionRow) =>
        applyReactionDelta(row.message_id, row.emoji, row.user_id, 'add'),
      onDelete: (row: ChannelReactionRow) =>
        applyReactionDelta(row.message_id, row.emoji, row.user_id, 'remove'),
    }),
    [applyReactionDelta]
  );

  useChannelReactionsRealtime(
    channel.id,
    currentUserId,
    messageIdSet,
    reactionCallbacks
  );

  // Ask the Q&A bot about a message we just posted. The route is handed only
  // the message id and re-reads the row server-side, so it can verify the
  // asker owns it — the question text itself is never sent from here.
  const askBot = useCallback(
    async (messageId: string) => {
      setBotNotice(null);
      setBotThinking(true);

      // The bot has no browser session, so nothing broadcasts on its behalf.
      // We do it here. createClient() is a singleton and supabase.channel()
      // returns the channel this screen already subscribed to rather than
      // opening a competing one, so this rides the live subscription.
      // Broadcasts don't echo to the sender, hence `botThinking` above for the
      // asker's own view.
      if (botUserId) {
        const supabase = createClient();
        const ch = supabase.channel(`chat:${channel.id}`);
        const beat = () =>
          void ch.send({
            type: 'broadcast',
            event: 'typing',
            payload: { user_id: botUserId },
          });
        beat();
        botBeatRef.current = setInterval(beat, BOT_TYPING_BEAT_MS);
      }

      try {
        const res = await fetch('/api/bot/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId }),
        });
        // A 200 needs no UI at all — the answer lands as an ordinary message
        // over Realtime, quoting the question.
        if (res.status === 429) setBotNotice('rate_limited');
        else if (res.status === 503) setBotNotice('unavailable');
        else if (!res.ok) setBotNotice('failed');
      } catch {
        setBotNotice('failed');
      } finally {
        if (botBeatRef.current) {
          clearInterval(botBeatRef.current);
          botBeatRef.current = null;
        }
        setBotThinking(false);
      }
    },
    [botUserId, channel.id]
  );

  // The actual send. Split out of handleSend so the consent explainer can hold
  // a question back and replay it verbatim once accepted.
  const deliver = useCallback(
    async (body: string, replyId: string | null) => {
      const optimisticId = `opt-${Date.now()}`;
      const optimistic: ChatMessage = {
        id: optimisticId,
        author_id: currentUserId,
        body,
        sent_at: new Date(),
        reply_to_id: replyId,
        reactions: {},
        profiles: {
          trainer_name: currentUserName,
          avatar_url: profileById.get(currentUserId)?.avatar_url ?? null,
          team: profileById.get(currentUserId)?.team ?? null,
          level: profileById.get(currentUserId)?.level ?? null,
        },
      };
      setMessages((prev) => [...prev, optimistic]);
      // Analytics: channel message sent. Channel slug only — never the body.
      track('channel_message_sent', { channel: channel.id });

      const { data, error } = await sendMessage(
        channel.id,
        currentUserId,
        body,
        replyId
      );

      if (error || !data) {
        // Drop the placeholder instead of leaving a ghost that never resolves
        // (a banned account, for instance, is refused by RLS on INSERT).
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setBotNotice('send_failed');
        return;
      }

      // parseQuestion here, not looksLikeQuestion: a bare "!pogo" or an
      // over-long one is a message like any other, and the route would only
      // reject it. The explainer gate upstream is the looser of the two.
      if (isQaChannel(channel.id) && parseQuestion(body) !== null) {
        await askBot(data.id);
      }
    },
    [askBot, channel.id, currentUserId, currentUserName, profileById]
  );

  async function handleSend(body: string) {
    const replyId = replyTo?.id ?? null;
    setReplyTo(null);

    // First !pogo on this device: explain where the question goes before it
    // goes anywhere. The message is held, not dropped — accepting sends it.
    //
    // Gated on looksLikeQuestion (did they type the trigger), NOT parseQuestion
    // (is it a valid question). A bare "!pogo" or an over-long one parses to
    // null but still shows intent, and someone who has clearly tried to reach
    // the bot deserves the explainer rather than silence.
    if (
      isQaChannel(channel.id) &&
      looksLikeQuestion(body) &&
      !hasBotConsent()
    ) {
      setBotConsentBody(body);
      return;
    }

    await deliver(body, replyId);
  }

  // Accepting the explainer records it and sends the held question.
  function acceptBotConsent() {
    const held = botConsentBody;
    try {
      window.localStorage.setItem(BOT_CONSENT_KEY, '1');
    } catch {
      // Storage unavailable — the explainer shows again next time, which is a
      // harmless outcome. Don't block the question on it.
    }
    setBotConsentBody(null);
    // Replies are cleared when the sheet opens, so the held question sends
    // unthreaded — matching what the member saw before the explainer appeared.
    if (held) void deliver(held, null);
  }

  // Tap a bubble → open the action sheet.
  function handleMessageTap(message: ChatMessage) {
    // Don't open the sheet for optimistic placeholders (id not in DB yet).
    if (message.id.startsWith('opt-')) return;
    setActionMsgId(message.id);
  }

  // Toggle a reaction from a chip OR from the sheet. Optimistically update the
  // override map, then fire the DB write — realtime echo will reconcile.
  function handleReactToggle(messageId: string, emoji: string) {
    const sourceMsg = messages.find((m) => m.id === messageId);
    if (!sourceMsg || messageId.startsWith('opt-')) return;
    const currentList =
      reactionOverrides[messageId]?.[emoji] ??
      sourceMsg.reactions[emoji] ??
      [];
    const has = currentList.includes(currentUserId);
    // Analytics: only count newly-added reactions (not removals). Surface only.
    if (!has) track('reaction_added', { surface: 'channel' });
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

  function handleSheetReport() {
    setReportMsgId(actionMsgId);
    setActionMsgId(null);
  }

  // Build the visual row list — day separators between groups whose first
  // message crosses a calendar day boundary from the previous group.
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

  // column-reverse pins to the bottom by default — the FIRST DOM child becomes
  // the visual bottom, so the rows must be reversed and the welcome banner
  // (visually on top) sits at the END.
  const reversedRows = [...rows].reverse();

  const onlineMembers = profiles.filter((p) => onlineIds.has(p.user_id));
  const headerStack = onlineMembers.slice(0, 3);
  const typingNames = Array.from(typingUserIds)
    .map((id) => profileById.get(id)?.trainer_name)
    .filter((n): n is string => Boolean(n));

  // Our own bot-typing broadcast doesn't echo back to us, so the asker would
  // otherwise see nothing while waiting. Add it locally for this client only.
  if (botThinking && botName && !typingNames.includes(botName)) {
    typingNames.push(botName);
  }

  // Composer reply preview names: "dig" when replying to yourself, otherwise
  // the resolved trainer name. Computed here so Composer stays presentational.
  const replyToName = replyTo
    ? replyTo.author_id === currentUserId
      ? t('you_lowercase')
      : replyTo.profiles?.trainer_name ?? ''
    : '';

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
              messagesById={messagesById}
              currentUserId={currentUserId}
              highlightedId={actionMsgId}
              onTap={handleMessageTap}
              onReactToggle={handleReactToggle}
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

      {/* Q&A bot notice — sits just above the composer, dismissible. Only the
          asker sees it; everyone else simply never gets an answer. */}
      {botNotice && (
        <div className="fixed bottom-[70px] left-0 right-0 z-20 px-3 pb-2">
          <div
            role="status"
            className="mx-auto max-w-[480px] bg-card border border-border rounded-lg px-3 py-2.5 flex items-start gap-2 shadow-sm"
          >
            <p className="flex-1 text-[13px] text-card-foreground leading-snug">
              {botNotice === 'rate_limited'
                ? t('botRateLimited')
                : botNotice === 'unavailable'
                  ? t('botUnavailable')
                  : botNotice === 'send_failed'
                    ? t('sendFailed')
                    : t('botFailed')}
            </p>
            <button
              type="button"
              onClick={() => setBotNotice(null)}
              aria-label={t('close')}
              className="w-6 h-6 -mr-1 shrink-0 flex items-center justify-center rounded-full text-muted-foreground"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <Composer
        channelName={channel.name}
        onSend={handleSend}
        onTyping={broadcastTyping}
        replyTo={replyTo}
        replyToName={replyToName}
        onCancelReply={() => setReplyTo(null)}
      />

      {/* Bot explainer — shown once per device before the first !pogo question.
          Holds the question until the member accepts; cancelling discards it. */}
      {botConsentBody !== null && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBotConsentBody(null);
          }}
        >
          <div className="bg-card rounded-t-2xl w-full max-w-[480px] mx-auto max-h-[85vh] overflow-y-auto px-4 pt-4 pb-6 flex flex-col gap-3">
            <h2 className="text-[16px] font-bold text-card-foreground">
              {t('botConsentTitle')}
            </h2>
            <p className="text-[14px] text-card-foreground leading-relaxed">
              {t('botConsentWhat')}
            </p>
            <p className="text-[14px] text-card-foreground leading-relaxed">
              {t('botConsentWho')}
            </p>
            <p className="text-[14px] font-semibold text-card-foreground leading-relaxed">
              {t('botConsentNoPersonal')}
            </p>
            <button
              type="button"
              onClick={acceptBotConsent}
              className="h-[52px] w-full mt-1 bg-primary text-primary-foreground rounded-md flex items-center justify-center text-base font-semibold"
            >
              {t('botConsentAccept')}
            </button>
            <button
              type="button"
              onClick={() => setBotConsentBody(null)}
              className="h-[44px] w-full text-[15px] font-semibold text-muted-foreground"
            >
              {t('botConsentCancel')}
            </button>
          </div>
        </div>
      )}

      <MembersSheet
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        profiles={profiles}
        onlineIds={onlineIds}
        currentUserId={currentUserId}
        onOpenDM={(partnerId) => router.push(`/chat/dm/${partnerId}`)}
      />

      <MessageActionSheet
        message={actionMsgId ? messagesById[actionMsgId] ?? null : null}
        currentUserId={currentUserId}
        onClose={() => setActionMsgId(null)}
        onReact={handleSheetReact}
        onReply={handleSheetReply}
        onCopy={handleSheetCopy}
        onReport={handleSheetReport}
      />

      <ReportSheet
        message={reportMsgId ? messagesById[reportMsgId] ?? null : null}
        surface="channel"
        onClose={() => setReportMsgId(null)}
      />
    </div>
  );
}
