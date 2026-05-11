'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Check, Minus, Plus, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { joinRaid, leaveRaid, updateAttendeeExtra } from '@/lib/raids/helpers';
import { sendMessage, type RaidMessage, type RaidMessageRow } from '@/lib/raids/message-helpers';
import { useRaidsRealtime } from '@/lib/raids/use-raids-realtime';
import type { RaidWithDetails } from '@/lib/raids/server-helpers';

interface RaidDetailProps {
  raid: RaidWithDetails;
  currentUserId: string;
  currentUserName: string;
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

// Human-readable relative time for a raid's start/creation time.
function relativeLabel(raid: RaidWithDetails): string {
  const reference = raid.starts_at ?? raid.created_at;
  const diffMs = Date.now() - new Date(reference).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < -1) return `Om ${Math.abs(diffMin)} min`;
  if (diffMin <= 1) return 'Starter nu';
  return `Startede for ${diffMin} min siden`;
}

// Full-screen detail view for a single raid — includes RSVP, attendees, and chat.
export function RaidDetail({ raid, currentUserId, currentUserName }: RaidDetailProps) {
  const t = useTranslations('Raids');
  const router = useRouter();

  const myAttendee = raid.raid_attendees.find(a => a.user_id === currentUserId);
  const [joined, setJoined] = useState(!!myAttendee);
  const [extra, setExtra] = useState(myAttendee?.extra_count ?? 0);
  const [messages, setMessages] = useState<RaidMessage[]>(raid.raid_messages);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);

  // Optimistic attendees — seeded from server data
  const [attendees, setAttendees] = useState(raid.raid_attendees);

  // Ref so the realtime message handler always reads the latest attendees list
  // without needing the subscription effect to re-run on every state change.
  const attendeesRef = useRef(attendees);
  attendeesRef.current = attendees;

  const timeLabel = relativeLabel(raid);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Realtime: attendee changes trigger router.refresh (needs the profile join);
  // message INSERTs are handled locally — avoids a full RSC refetch per chat message.
  // The sender's trainer_name is resolved from the local attendees list (fast path);
  // if not found (sender hasn't RSVP'd), the name falls back to null.
  // Optimistic messages from the current user are replaced when the real row arrives.
  useRaidsRealtime(raid.id, (row: RaidMessageRow) => {
    const knownAttendee = attendeesRef.current.find(a => a.user_id === row.user_id);
    const msg: RaidMessage = {
      ...row,
      profiles: knownAttendee?.profiles ?? null,
    };
    setMessages(prev => {
      // Replace the optimistic placeholder for this sender if one exists
      if (prev.some(m => m.id.startsWith('opt-') && m.user_id === row.user_id)) {
        return prev.map(m =>
          m.id.startsWith('opt-') && m.user_id === row.user_id ? msg : m
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
  }

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleJoin() {
    setJoined(true);
    setAttendees(prev => [
      ...prev,
      { user_id: currentUserId, extra_count: 0, profiles: { trainer_name: currentUserName } },
    ]);
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

  async function handleSend() {
    const text = chatInput.trim();
    if (!text || sending) return;
    setSending(true);
    // Optimistic append
    const optimistic: RaidMessage = {
      id: `opt-${Date.now()}`,
      raid_id: raid.id,
      user_id: currentUserId,
      message: text,
      created_at: new Date().toISOString(),
      profiles: { trainer_name: currentUserName },
    };
    setMessages(prev => [...prev, optimistic]);
    setChatInput('');
    await sendMessage(raid.id, currentUserId, text);
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleOpenMap() {
    if (!raid.gym_name) return;
    const query = encodeURIComponent(`${raid.gym_name} Frederikssund Danmark`);
    window.open(`https://www.google.com/maps/search/${query}`);
  }

  const headerTitle = [raid.boss_name, raid.gym_name].filter(Boolean).join(' · ') || 'Raid';

  // Friendly time string for meta bar
  const startsAtDate = raid.starts_at ? new Date(raid.starts_at) : new Date(raid.created_at);
  const timeString = startsAtDate.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Fixed header */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-card border-b border-border h-14 flex items-center gap-3 px-4">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground"
          aria-label={t('detail.back')}
        >
          <ArrowLeft size={22} />
        </button>
        <p className="text-[16px] font-bold text-card-foreground truncate flex-1">{headerTitle}</p>
      </div>

      {/* Scrollable body */}
      <div className="pt-14 pb-[72px] overflow-y-auto flex-1">
        {/* Hero image */}
        <div className="relative h-[190px] bg-input">
          {raid.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={raid.image_url}
              alt="Raid screenshot"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary">
              <span className="text-[48px]">⚔️</span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/55" />
          {/* Bottom-left: boss + gym */}
          <div className="absolute bottom-3 left-4">
            {raid.boss_name && (
              <p className="text-[22px] font-extrabold text-white leading-tight">{raid.boss_name}</p>
            )}
            {raid.gym_name && (
              <p className="text-[13px] text-white/85">{raid.gym_name}</p>
            )}
          </div>
          {/* Bottom-right: timer badge */}
          <div className="absolute bottom-3 right-4">
            <span className="bg-primary text-primary-foreground text-[11px] font-bold px-2 py-1 rounded-full">
              {timeLabel}
            </span>
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

        {/* RSVP section */}
        <div className="px-4 py-3.5 border-b border-border">
          <p className="text-[14px] font-bold mb-2.5">{t('detail.rsvpTitle')}</p>

          {/* Button + stepper row */}
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
        <div className="px-4 pt-3.5 pb-4">
          <p className="text-[14px] font-bold mb-3">{t('detail.chatTitle')}</p>

          {messages.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-6">
              {t('detail.noMessages')}
            </p>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className="flex gap-2.5 mb-3">
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-secondary text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                  {msg.profiles?.trainer_name ? initials(msg.profiles.trainer_name) : '?'}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-bold">
                      {msg.profiles?.trainer_name ?? '—'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(msg.created_at).toLocaleTimeString('da-DK', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="bg-input rounded-[4px_10px_10px_10px] px-2.5 py-1.5 text-[14px] leading-snug mt-0.5 break-words">
                    {msg.message}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Pinned chat input */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-2.5 flex gap-2 items-center z-10">
        <input
          type="text"
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('detail.chatPlaceholder')}
          className="flex-1 h-10 rounded-full border border-border bg-input px-4 text-[14px] placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!chatInput.trim() || sending}
          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center disabled:opacity-60"
          aria-label={t('detail.send')}
        >
          <Send size={16} className="text-white" />
        </button>
      </div>
    </div>
  );
}
