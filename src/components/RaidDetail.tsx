'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, MapPin, Check, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { joinRaid, leaveRaid, updateAttendeeExtra, toggleRaidCompleted } from '@/lib/raids/helpers';
import {
  REACTION_CODES,
  groupRaidReactions,
  reactorName,
  toggleRaidReaction,
  type ReactionCode,
  type RaidReactionRow as RaidLevelReactionRow,
} from '@/lib/raids/raid-reaction-helpers';
import { useRaidReactionRealtime } from '@/lib/raids/use-raid-reaction-realtime';
import {
  sendMessage,
  type RaidMessage,
  type RaidMessageRow,
} from '@/lib/raids/message-helpers';
import {
  groupReactions,
  toggleReaction,
  type RaidReactionRow,
} from '@/lib/raids/reactions-helpers';
import { useRaidsRealtime } from '@/lib/raids/use-raids-realtime';
import { useRaidReactionsRealtime } from '@/lib/raids/use-raid-reactions-realtime';
import { track } from '@/lib/analytics/amplitude';
import {
  daySeparator,
  groupMessages,
  type MessageGroup as MessageGroupType,
} from '@/lib/chat/time';
import type { ChatMessage } from '@/lib/chat/types';
import type { RaidWithDetails } from '@/lib/raids/server-helpers';
import { Composer } from '@/components/chat/Composer';
import { MessageActionSheet } from '@/components/chat/MessageActionSheet';
import { MessageGroupView } from '@/components/chat/MessageGroup';

interface RaidDetailProps {
  raid: RaidWithDetails;
  currentUserId: string;
  currentUserName: string;
  // user_id → trainer_name for everyone in the directory, so raid reactions can
  // show who reacted (raid_reactions has no profile join — see the page).
  profileNames: Record<string, string>;
}

// Derive initials from a trainer name (up to 2 chars).
function initials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Convert server `RaidMessage` (column name `message`) into the canonical
// `ChatMessage` shape consumed by `MessageGroupView`. Reactions are
// pre-grouped here so the renderer can stay synchronous.
function toChatMessage(row: RaidMessage): ChatMessage {
  const reactionRows = (row.reactions ?? []).map((r) => ({
    message_id: row.id,
    user_id: r.user_id,
    emoji: r.emoji,
  }));
  return {
    id: row.id,
    author_id: row.user_id,
    body: row.message,
    sent_at: new Date(row.created_at),
    reply_to_id: row.reply_to_id ?? null,
    reactions: groupReactions(reactionRows),
    profiles: row.profiles
      ? {
          trainer_name: row.profiles.trainer_name,
          avatar_url: row.profiles.avatar_url,
          team: row.profiles.team,
          level: row.profiles.level,
        }
      : null,
  };
}

// Full-screen detail view for a single raid — includes RSVP, attendees, and chat.
export function RaidDetail({ raid, currentUserId, currentUserName, profileNames }: RaidDetailProps) {
  const t = useTranslations('Raids');
  const tChat = useTranslations('Chat');
  const router = useRouter();

  const isPoster = currentUserId === raid.user_id;

  const myAttendee = raid.raid_attendees.find(a => a.user_id === currentUserId);
  const [joined, setJoined] = useState(!!myAttendee);
  const [extra, setExtra] = useState(myAttendee?.extra_count ?? 0);

  // Completion state — optimistic, owned by the poster.
  const [completedAt, setCompletedAt] = useState<string | null>(raid.completed_at);

  // Raid-level reactions ("TfR!", shiny, hundo) — grouped user_id lists per code.
  // Optimistic local toggles + realtime reconcile.
  const [raidReactions, setRaidReactions] = useState(() =>
    groupRaidReactions(raid.raid_reactions ?? [])
  );

  // Messages live in client state — raid chat stays local-state-driven (the
  // realtime hook below appends INSERTs directly instead of refreshing the RSC).
  const [messages, setMessages] = useState<ChatMessage[]>(
    raid.raid_messages.map(toChatMessage)
  );

  // Slice 16 chat orchestration — mirrors ChannelScreen.
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [actionMsgId, setActionMsgId] = useState<string | null>(null);
  // Sparse overlay: messageId → grouped reactions. Wins over messages[i].reactions
  // when present. Set via realtime + optimistic toggles.
  const [reactionOverrides, setReactionOverrides] = useState<
    Record<string, Record<string, string[]>>
  >({});

  // Optimistic attendees — seeded from server data
  const [attendees, setAttendees] = useState(raid.raid_attendees);

  // Ref so the realtime message handler always reads the latest attendees list
  // without needing the subscription effect to re-run on every state change.
  const attendeesRef = useRef(attendees);
  // Must update via effect — React 19 react-hooks/refs forbids ref.current writes during render.
  useEffect(() => { attendeesRef.current = attendees; }, [attendees]);

  // Realtime: attendee changes trigger router.refresh (needs the profile join);
  // message INSERTs are handled locally — avoids a full RSC refetch per chat message.
  // The sender's trainer_name is resolved from the local attendees list (fast path);
  // if not found (sender hasn't RSVP'd), the name falls back to null. Realtime
  // INSERTs don't carry the joined profile so avatar/team/level remain null
  // until the next router.refresh hydrates them — acceptable for the in-raid
  // chat (small audience, attendees usually known).
  useRaidsRealtime(raid.id, (row: RaidMessageRow) => {
    const knownAttendee = attendeesRef.current.find(a => a.user_id === row.user_id);
    const msg: ChatMessage = {
      id: row.id,
      author_id: row.user_id,
      body: row.message,
      sent_at: new Date(row.created_at),
      reply_to_id: row.reply_to_id ?? null,
      reactions: {},
      profiles: knownAttendee?.profiles
        ? {
            trainer_name: knownAttendee.profiles.trainer_name,
            avatar_url: null,
            team: null,
            level: null,
          }
        : null,
    };
    setMessages(prev => {
      // Replace the optimistic placeholder for this sender if one exists
      if (prev.some(m => m.id.startsWith('opt-') && m.author_id === row.user_id)) {
        return prev.map(m =>
          m.id.startsWith('opt-') && m.author_id === row.user_id ? msg : m
        );
      }
      // Deduplicate (defensive against double-delivery)
      if (prev.some(m => m.id === row.id)) return prev;
      return [...prev, msg];
    });
  });

  // Sync joined/extra/attendees when a fresh `raid` prop arrives (router.refresh
  // after an attendee change). Messages are intentionally excluded — they are
  // managed locally via the realtime callback above and must not be overwritten.
  const [raidSnapshot, setRaidSnapshot] = useState(raid);
  if (raidSnapshot !== raid) {
    setRaidSnapshot(raid);
    const me = raid.raid_attendees.find(a => a.user_id === currentUserId);
    setJoined(!!me);
    setExtra(me?.extra_count ?? 0);
    setAttendees(raid.raid_attendees);
    setCompletedAt(raid.completed_at);
    setRaidReactions(groupRaidReactions(raid.raid_reactions ?? []));
  }

  // Apply reaction overrides on top of the source messages.
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

  const reactionCallbacks = useMemo(
    () => ({
      onInsert: (row: RaidReactionRow) =>
        applyReactionDelta(row.message_id, row.emoji, row.user_id, 'add'),
      onDelete: (row: RaidReactionRow) =>
        applyReactionDelta(row.message_id, row.emoji, row.user_id, 'remove'),
    }),
    [applyReactionDelta]
  );

  useRaidReactionsRealtime(
    raid.id,
    currentUserId,
    messageIdSet,
    reactionCallbacks
  );

  // Apply a single raid-level reaction delta into local grouped state.
  const applyRaidReactionDelta = useCallback(
    (reaction: string, userId: string, kind: 'add' | 'remove') => {
      const code = reaction as ReactionCode;
      if (!REACTION_CODES.includes(code)) return;
      setRaidReactions((prev) => {
        const list = prev[code];
        if (kind === 'add') {
          if (list.includes(userId)) return prev; // no-op
          return { ...prev, [code]: [...list, userId] };
        }
        if (!list.includes(userId)) return prev;
        return { ...prev, [code]: list.filter((id) => id !== userId) };
      });
    },
    []
  );

  const raidReactionCallbacks = useMemo(
    () => ({
      onInsert: (row: RaidLevelReactionRow) =>
        applyRaidReactionDelta(row.reaction, row.user_id, 'add'),
      onDelete: (row: RaidLevelReactionRow) =>
        applyRaidReactionDelta(row.reaction, row.user_id, 'remove'),
    }),
    [applyRaidReactionDelta]
  );

  useRaidReactionRealtime(raid.id, currentUserId, raidReactionCallbacks);

  // Toggle a raid-level reaction: optimistic local flip, then DB write.
  // Realtime echo reconciles. Available on all raids, incl. ended/completed.
  function handleRaidReactionToggle(code: ReactionCode) {
    const isOn = raidReactions[code].includes(currentUserId);
    if (!isOn) track('reaction_added', { surface: 'raid' });
    applyRaidReactionDelta(code, currentUserId, isOn ? 'remove' : 'add');
    void toggleRaidReaction(raid.id, currentUserId, code, isOn);
  }

  // Poster-only: mark the raid completed / undo. Optimistic, then DB write.
  async function handleToggleCompleted() {
    const next = completedAt ? null : new Date().toISOString();
    setCompletedAt(next);
    await toggleRaidCompleted(raid.id, !!next);
    // Bust the client Router Cache so the raids overview reflects the new
    // completion state no matter how the user navigates away (back button,
    // BottomNav, or sidebar) — not just via the back button (issue #116).
    router.refresh();
  }

  async function handleJoin() {
    setJoined(true);
    setAttendees(prev => [
      ...prev,
      { user_id: currentUserId, extra_count: 0, profiles: { trainer_name: currentUserName } },
    ]);
    // Analytics: joined a raid from its detail screen (no PII — no ids/names).
    track('raid_joined', { surface: 'detail' });
    await joinRaid(raid.id, currentUserId);
  }

  async function handleLeave() {
    setJoined(false);
    setExtra(0);
    setAttendees(prev => prev.filter(a => a.user_id !== currentUserId));
    await leaveRaid(raid.id, currentUserId);
  }

  async function handleExtraChange(delta: number) {
    const next = Math.max(0, Math.min(9, extra + delta));
    setExtra(next);
    setAttendees(prev =>
      prev.map(a =>
        a.user_id === currentUserId ? { ...a, extra_count: next } : a
      )
    );
    await updateAttendeeExtra(raid.id, currentUserId, next);
  }

  async function handleSend(body: string) {
    const replyId = replyTo?.id ?? null;
    // Optimistic append
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      author_id: currentUserId,
      body,
      sent_at: new Date(),
      reply_to_id: replyId,
      reactions: {},
      profiles: {
        trainer_name: currentUserName,
        avatar_url: null,
        team: null,
        level: null,
      },
    };
    setMessages(prev => [...prev, optimistic]);
    setReplyTo(null);
    await sendMessage(raid.id, currentUserId, body, replyId);
  }

  // Tap a bubble → open the action sheet (skip optimistic placeholders).
  function handleMessageTap(message: ChatMessage) {
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
    if (!has) track('reaction_added', { surface: 'raid' });
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

  function handleOpenMap() {
    if (!raid.gym_name) return;
    const query = encodeURIComponent(`${raid.gym_name} Frederikssund Danmark`);
    window.open(`https://www.google.com/maps/search/${query}`);
  }

  // Full labels for the tappable raid-reaction buttons (counts shown alongside).
  const reactionButtons: { code: ReactionCode; label: string }[] = [
    { code: 'tfr', label: t('reactionTfr') },
    { code: 'shiny', label: t('reactionShiny') },
    { code: 'hundo', label: t('reactionHundo') },
  ];

  const headerTitle = [raid.boss_name, raid.gym_name].filter(Boolean).join(' · ') || 'Raid';

  // Friendly time string for meta bar
  const startsAtDate = raid.starts_at ? new Date(raid.starts_at) : new Date(raid.created_at);
  const timeString = startsAtDate.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

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

  // Composer reply preview name: "dig" when replying to yourself, otherwise
  // the resolved trainer name. Computed here so Composer stays presentational.
  const replyToName = replyTo
    ? replyTo.author_id === currentUserId
      ? tChat('you_lowercase')
      : replyTo.profiles?.trainer_name ?? ''
    : '';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Fixed header */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-card border-b border-border h-14 flex items-center gap-3 px-4">
        <button
          // Push to /raids (this page's parent), not router.back(): when the
          // raid is opened from a push notification the SW opens a fresh window
          // with no in-app history, so router.back() is a no-op and the user is
          // stuck on the page (issue #114). Mirrors DMHeader's push to /chat.
          // router.refresh() first invalidates the client Router Cache so the
          // overview refetches fresh on arrival instead of serving this raid's
          // pre-visit RSC payload — otherwise the card shows stale completion
          // status / unread badge (markRaidRead ran server-side on load) (#116).
          onClick={() => {
            router.refresh();
            router.push('/raids');
          }}
          className="text-muted-foreground"
          aria-label={t('detail.back')}
        >
          <ArrowLeft size={22} />
        </button>
        <p className="text-[16px] font-bold text-card-foreground truncate flex-1">{headerTitle}</p>
      </div>

      {/* Scrollable body */}
      <div className="pt-14 pb-[140px] overflow-y-auto flex-1">
        {/* Hero image */}
        <div className="relative h-[300px] bg-input overflow-hidden">
          {raid.image_url ? (
            <>
              {/* Blurred backdrop fills the letterbox space behind the full image */}
              <Image
                src={raid.image_url}
                alt=""
                aria-hidden
                fill
                sizes="100vw"
                className="object-cover scale-110 blur-2xl"
              />
              {/* Full screenshot, scaled to fit — never cropped */}
              <Image
                src={raid.image_url}
                alt="Raid screenshot"
                fill
                sizes="100vw"
                className="object-contain"
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary">
              <span className="text-[48px]">⚔️</span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/55" />
          {/* Bottom-left: boss + gym */}
          <div className="absolute bottom-3 left-4">
            {completedAt && (
              <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-bold text-primary-foreground">
                <Check size={13} />
                {t('completed')}
              </span>
            )}
            {raid.boss_name && (
              <p className="text-[22px] font-extrabold text-white leading-tight">{raid.boss_name}</p>
            )}
            {raid.gym_name && (
              <p className="text-[13px] text-white/85">{raid.gym_name}</p>
            )}
          </div>
        </div>

        {/* Meta bar */}
        <div className="px-4 py-2.5 flex justify-between items-center border-b border-border">
          <p className="text-[13px] text-muted-foreground">{timeString}</p>
          {raid.gym_name && (
            <button
              onClick={handleOpenMap}
              className="bg-secondary rounded-full px-3 py-1 flex items-center gap-1.5 text-[12px] font-bold text-primary"
            >
              <MapPin size={13} />
              {t('detail.showOnMap')}
            </button>
          )}
        </div>

        {/* Raid reactions + poster completion toggle */}
        <div className="px-4 py-3.5 border-b border-border flex flex-col gap-3">
          {/* Reaction buttons — anyone who can see the raid can react. Available
              on all raids, including ended/completed (post-raid "TfR"). */}
          <div className="flex flex-wrap gap-2">
            {reactionButtons.map(({ code, label }) => {
              const users = raidReactions[code];
              const mine = users.includes(currentUserId);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleRaidReactionToggle(code)}
                  className={`h-9 rounded-full px-3 text-[13px] font-bold border transition-all flex items-center gap-1.5 ${
                    mine
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-background border-border text-card-foreground'
                  }`}
                  aria-pressed={mine}
                >
                  <span>{label}</span>
                  {users.length > 0 && <span>{users.length}</span>}
                </button>
              );
            })}
          </div>

          {/* Who reacted — one row per non-empty reaction, naming each reactor.
              Resolves names from profileNames; "Dig" for the current user.
              Updates live via the same raidReactions state the buttons use. */}
          {reactionButtons.some(({ code }) => raidReactions[code].length > 0) && (
            <div className="flex flex-col gap-2">
              {reactionButtons.map(({ code, label }) => {
                const users = raidReactions[code];
                if (users.length === 0) return null;
                return (
                  <div key={code} className="flex items-start gap-2">
                    <span className="text-[12px] font-bold text-muted-foreground shrink-0 mt-1 min-w-[64px]">
                      {label}
                    </span>
                    <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                      {users.map((uid) => {
                        const name = reactorName(
                          uid,
                          currentUserId,
                          profileNames,
                          t('reactionYou'),
                          t('reactionUnknownUser')
                        );
                        const initialsSource =
                          uid === currentUserId
                            ? currentUserName
                            : profileNames[uid] ?? '';
                        return (
                          <div key={uid} className="flex items-center gap-1.5">
                            <div className="w-[22px] h-[22px] rounded-full bg-secondary text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                              {initialsSource ? initials(initialsSource) : '?'}
                            </div>
                            <span className="text-[12px] font-semibold">{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Poster-only: mark completed / undo */}
          {isPoster && (
            <button
              type="button"
              onClick={handleToggleCompleted}
              className={`h-10 self-start rounded-lg px-4 text-[13px] font-bold border transition-all flex items-center gap-1.5 ${
                completedAt
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'bg-background border-border text-card-foreground'
              }`}
            >
              {completedAt && <Check size={15} />}
              {completedAt ? t('completedMark') : t('markCompleted')}
            </button>
          )}
        </div>

        {/* RSVP section */}
        <div className="px-4 py-3.5 border-b border-border">
          <p className="text-[14px] font-bold mb-2.5">
            {completedAt ? t('detail.rsvpClosed') : t('detail.rsvpTitle')}
          </p>

          {/* Button + stepper row — hidden once the raid is completed; you can no
              longer mark participation, the attendees list below becomes read-only. */}
          {!completedAt && (
            <div className="flex gap-2 items-center flex-wrap">
              <button
                onClick={joined ? handleLeave : handleJoin}
                className={`flex-1 min-w-[120px] h-11 rounded-lg font-bold text-[14px] border transition-all flex items-center justify-center gap-1.5 ${
                  joined
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-background border-border text-card-foreground'
                }`}
              >
                {joined && <Check size={16} />}
                {t('detail.joinButton')}
              </button>

              {joined && (
                <div className="bg-input rounded-lg px-3 h-11 flex items-center gap-2">
                  <span className="text-[13px] text-muted-foreground">{t('detail.extra')}</span>
                  <button
                    type="button"
                    disabled={extra === 0}
                    onClick={() => handleExtraChange(-1)}
                    className="w-7 h-7 flex items-center justify-center text-muted-foreground disabled:opacity-40"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-[15px] font-bold text-primary w-5 text-center">{extra}</span>
                  <button
                    type="button"
                    disabled={extra === 9}
                    onClick={() => handleExtraChange(1)}
                    className="w-7 h-7 flex items-center justify-center text-muted-foreground disabled:opacity-40"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Attendees list */}
          {attendees.length > 0 && (
            <div className="flex flex-wrap gap-2.5 mt-3">
              {attendees.map(a => (
                <div key={a.user_id} className="flex items-center gap-1.5">
                  <div className="w-[26px] h-[26px] rounded-full bg-secondary text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                    {a.profiles?.trainer_name ? initials(a.profiles.trainer_name) : '?'}
                  </div>
                  <span className="text-[12px] font-semibold">
                    {a.profiles?.trainer_name ?? '—'}
                  </span>
                  {(a.extra_count ?? 0) > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      +{a.extra_count}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat section */}
        <div className="px-3 pt-3.5 pb-4">
          <p className="text-[14px] font-bold mb-3 px-1">{t('detail.chatTitle')}</p>

          {rows.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-6">
              {t('detail.noMessages')}
            </p>
          ) : (
            <div className="flex flex-col">
              {rows.map((row) => {
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
            </div>
          )}
        </div>
      </div>

      {/* Composer (replaces the old pinned <input> strip). Passes the
          channelName-shaped placeholder using the raid's boss/gym header. */}
      <Composer
        channelName={headerTitle}
        onSend={handleSend}
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
