'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Smartphone,
  SkipForward,
  UserCheck,
  CheckCircle2,
  MinusCircle,
  Users,
} from 'lucide-react';
import type { Profile } from '@/lib/profile/helpers';
import { Avatar, TeamChip, LevelPill, TEAMS, type AvatarTeam } from '@/components/Avatar';
import { FriendCodeQR } from '@/components/FriendCodeQR';
import { FriendCodeHidden } from '@/components/FriendCodeHidden';

interface DesktopPlayersProps {
  /** All profiles, including the logged-in user (filtered out of the queue). */
  profiles: Profile[];
  currentUserId: string;
  // Online set from the parent's single `usePresence` subscription (see
  // PlayersScreen) — avoids a second colliding `players-online` channel.
  onlineUserIds: Set<string>;
}

type ScanStatus = 'added' | 'skipped';

// Desktop "Scan-session": one big QR on screen at a time so a phone camera can't
// lock onto the wrong code. Work down the queue on the left with the
// "Tilføjet → næste" / "Spring over" buttons. Ported from the desktop design
// mock (PageSpillere.jsx) onto real profile data + the real, scannable
// FriendCodeQR.
export function DesktopPlayers({ profiles, currentUserId, onlineUserIds }: DesktopPlayersProps) {
  const t = useTranslations('DesktopPlayers');
  const tDir = useTranslations('PlayerDirectory');

  const list = useMemo(
    () => profiles.filter((p) => p.user_id !== currentUserId),
    [profiles, currentUserId]
  );

  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState<Record<string, ScanStatus>>({});
  const [copied, setCopied] = useState(false);

  const addedCount = Object.values(status).filter((s) => s === 'added').length;
  const cur = list[idx];

  function mark(s: ScanStatus) {
    if (!cur) return;
    setStatus((prev) => ({ ...prev, [cur.id]: s }));
    if (idx < list.length - 1) setIdx(idx + 1);
  }

  async function copyCode() {
    if (!cur) return;
    try {
      await navigator.clipboard.writeText(cur.friend_code);
    } catch {
      // Clipboard can fail silently in iframes / older browsers; ignore.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Arrow Up/Down move through the queue (the list is vertical). Ignore the
  // keys while focused in a text field, and prevent the default page scroll.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        return;
      }
      e.preventDefault();
      setIdx((i) =>
        e.key === 'ArrowUp' ? Math.max(0, i - 1) : Math.min(list.length - 1, i + 1)
      );
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list.length]);

  // Keep the active queue row in view as the selection moves (keyboard/buttons).
  const activeRowRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  // No other players yet — nothing to scan.
  if (list.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
        <Users size={40} className="text-muted-foreground" />
        <p className="text-[15px] text-muted-foreground">{t('empty')}</p>
      </div>
    );
  }

  const curTeam = (cur.team ?? 'none') as AvatarTeam;
  const curOnline = onlineUserIds.has(cur.user_id);

  return (
    <div className="flex h-full min-h-0">
      {/* Queue */}
      <div className="w-[340px] flex-shrink-0 border-r border-border flex flex-col bg-card">
        <div className="px-5 pt-[22px] pb-3.5">
          <div className="text-[20px] font-extrabold tracking-tight">{t('scanTitle')}</div>
          <div className="text-[13px] text-muted-foreground mt-0.5">{t('scanSubtitle')}</div>
          <div className="mt-3.5">
            <div className="flex justify-between text-[12px] font-bold text-[#5a5a5a] mb-1.5">
              <span>{t('addedCount', { count: addedCount })}</span>
              <span>
                {idx + 1} / {list.length}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full transition-[width] duration-300"
                style={{
                  width: `${((idx + 1) / list.length) * 100}%`,
                  background: 'linear-gradient(90deg,#00b09f,#7ec979)',
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pt-1 pb-4 flex flex-col gap-1">
          {list.map((p, i) => {
            const st = status[p.id];
            const isCur = i === idx;
            const teamMeta = TEAMS[(p.team ?? 'none') as AvatarTeam];
            return (
              <button
                key={p.id}
                ref={isCur ? activeRowRef : undefined}
                type="button"
                onClick={() => setIdx(i)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                style={{
                  border: isCur ? '1.5px solid var(--color-primary)' : '1.5px solid transparent',
                  background: isCur ? 'var(--color-background)' : 'transparent',
                  boxShadow: isCur ? '0 4px 14px rgba(0,176,159,0.12)' : 'none',
                  opacity: st && !isCur ? 0.55 : 1,
                }}
              >
                <Avatar
                  src={p.avatar_url}
                  name={p.first_name || p.trainer_name}
                  size={40}
                  team={(p.team ?? 'none') as AvatarTeam}
                  online={onlineUserIds.has(p.user_id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold truncate">{p.trainer_name}</div>
                  <div className="text-[12px] text-muted-foreground font-semibold">
                    {teamMeta.label !== '—' ? teamMeta.label : '—'}
                    {p.level != null && ` · Lvl ${p.level}`}
                  </div>
                </div>
                {st === 'added' && <CheckCircle2 size={18} className="text-success" />}
                {st === 'skipped' && <MinusCircle size={18} style={{ color: '#c8c8c8' }} />}
                {!st && isCur && (
                  <span
                    className="text-[10px] font-extrabold text-primary rounded-full"
                    style={{ background: 'var(--color-secondary)', padding: '3px 7px' }}
                  >
                    {t('now')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* The single big QR */}
      <div
        className="flex-1 flex flex-col min-w-0 relative"
        style={{ background: 'radial-gradient(circle at 50% 28%, #f6fcfb, #fff 70%)' }}
      >
        <div className="px-8 pt-6 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <Avatar
              src={cur.avatar_url}
              name={cur.first_name || cur.trainer_name}
              size={56}
              team={curTeam}
              online={curOnline}
              level={cur.level ?? null}
            />
            <div>
              <div className="text-[22px] font-extrabold tracking-tight">{cur.trainer_name}</div>
              <div className="flex items-center gap-2 mt-1">
                <TeamChip team={curTeam} size="sm" />
                <LevelPill level={cur.level ?? null} />
                {curOnline && (
                  <span
                    className="inline-flex items-center gap-[5px] text-[12px] font-bold"
                    style={{ color: '#0a8a17' }}
                  >
                    <span className="w-[7px] h-[7px] rounded-full bg-success" />
                    {t('onlineLabel')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIdx(Math.max(0, idx - 1))}
              disabled={idx === 0}
              aria-label="Forrige"
              className="w-11 h-11 rounded-xl border border-border flex items-center justify-center disabled:cursor-not-allowed"
              style={{
                background: idx === 0 ? '#f7f7f7' : 'var(--color-background)',
                color: idx === 0 ? '#c8c8c8' : '#1b3a52',
              }}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => setIdx(Math.min(list.length - 1, idx + 1))}
              disabled={idx === list.length - 1}
              aria-label="Næste"
              className="w-11 h-11 rounded-xl border border-border flex items-center justify-center disabled:cursor-not-allowed"
              style={{
                background: idx === list.length - 1 ? '#f7f7f7' : 'var(--color-background)',
                color: idx === list.length - 1 ? '#c8c8c8' : '#1b3a52',
              }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 pb-2 min-h-0">
          {cur.hide_friend_code ? (
            <FriendCodeHidden size={288} />
          ) : (
            <>
              <div
                className="bg-background rounded-3xl"
                style={{ padding: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.12), 0 0 0 1px #eee' }}
              >
                <FriendCodeQR value={cur.friend_code} size={288} />
              </div>
              <div className="flex items-center gap-2.5">
                <span
                  className="text-[25px] font-extrabold tabular-nums"
                  style={{ letterSpacing: '0.10em', color: '#1b3a52' }}
                >
                  {cur.friend_code}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  aria-label={copied ? tDir('copiedButton') : tDir('copyButton')}
                  className="w-[38px] h-[38px] rounded-[10px] border border-border bg-card text-primary inline-flex items-center justify-center"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <div className="text-[13px] text-muted-foreground flex items-center gap-1.5">
                <Smartphone size={15} />
                {t('instruction')}
              </div>
            </>
          )}
        </div>

        <div className="px-8 pt-3 pb-6 flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => mark('skipped')}
            className="h-[52px] px-6 rounded-xl border-[1.5px] border-border bg-background text-[15px] font-bold inline-flex items-center gap-2 whitespace-nowrap"
            style={{ color: '#5a5a5a' }}
          >
            <SkipForward size={17} />
            {t('skip')}
          </button>
          <button
            type="button"
            onClick={() => mark('added')}
            className="h-[52px] px-8 rounded-xl bg-primary text-primary-foreground text-[15px] font-extrabold inline-flex items-center gap-2 whitespace-nowrap"
            style={{ boxShadow: '0 8px 20px rgba(0,176,159,0.30)' }}
          >
            <UserCheck size={18} />
            {t('addedNext')}
          </button>
        </div>
      </div>
    </div>
  );
}
