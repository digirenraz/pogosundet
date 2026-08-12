'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ExternalLink, ShieldAlert } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import {
  MODERATOR_NOTE_MAX_LENGTH,
  reportContextHref,
  type MessageReport,
  type ModerationAction,
} from '@/lib/moderation/types';

// ---------------------------------------------------------------------------
// ModerationScreen — the moderator's queue at /admin.
//
// Two tabs: unreviewed reports ("Afventer") and a tail of already-handled ones
// ("Historik"). Each report card shows the snapshot of the reported message,
// who reported it and why, and the actions available.
//
// Every action POSTs to /api/moderation and then router.refresh() re-runs the
// server component, so the list always reflects real database state rather than
// an optimistic guess — this is a screen where showing something that didn't
// actually happen would be much worse than a moment's latency.
// ---------------------------------------------------------------------------

interface ModerationScreenProps {
  pending: MessageReport[];
  history: MessageReport[];
  /** Pre-translated page title — AppHeader takes a plain string. */
  title: string;
}

// Actions that need the moderator to type something first.
// - warn: the note IS the warning DM, so it's required
// - ban:  the note becomes the ban reason shown to the user, optional
const NOTE_ACTIONS = new Set<ModerationAction>(['warn', 'ban']);

export function ModerationScreen({
  pending,
  history,
  title,
}: ModerationScreenProps) {
  const t = useTranslations('Moderation');
  const router = useRouter();

  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  // The (report, action) pair currently awaiting a typed note, if any.
  const [noteFor, setNoteFor] = useState<{
    report: MessageReport;
    action: ModerationAction;
  } | null>(null);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(
    report: MessageReport,
    action: ModerationAction,
    actionNote: string | null = null
  ) {
    setBusyId(report.id);
    setError(null);
    try {
      const res = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          action,
          note: actionNote ?? undefined,
        }),
      });
      if (!res.ok) {
        setError(t('errorGeneric'));
        return;
      }
      setNoteFor(null);
      setNote('');
      router.refresh();
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  }

  // Actions needing a note open the composer first; the rest fire immediately.
  function handleAction(report: MessageReport, action: ModerationAction) {
    if (NOTE_ACTIONS.has(action)) {
      setNoteFor({ report, action });
      setNote('');
      setError(null);
      return;
    }
    void runAction(report, action);
  }

  const list = tab === 'pending' ? pending : history;

  return (
    <div className="min-h-screen bg-background pb-[90px]">
      <AppHeader title={title} />

      {/* AppHeader is fixed and two rows tall — same offset the other tab
          screens use to clear it. */}
      <div className="pt-[124px] px-3.5">
        {/* Tabs */}
        <div className="flex gap-2 mb-3">
          <TabButton
            active={tab === 'pending'}
            onClick={() => setTab('pending')}
            label={t('tabPending')}
            count={pending.length}
          />
          <TabButton
            active={tab === 'history'}
            onClick={() => setTab('history')}
            label={t('tabHistory')}
            count={null}
          />
        </div>

        {error && (
          <p className="text-[13px] text-destructive mb-3" role="alert">
            {error}
          </p>
        )}

        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ShieldAlert size={32} className="text-muted-foreground" />
            <p className="text-[15px] font-semibold text-card-foreground">
              {tab === 'pending' ? t('emptyPending') : t('emptyHistory')}
            </p>
            {tab === 'pending' && (
              <p className="text-[13px] text-muted-foreground max-w-[280px]">
                {t('emptyPendingHint')}
              </p>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                busy={busyId === report.id}
                onAction={handleAction}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Note composer — shown for "warn" (required) and "ban" (optional) */}
      {noteFor && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNoteFor(null);
          }}
        >
          <div className="bg-card rounded-t-2xl w-full max-w-[480px] mx-auto px-4 pt-4 pb-6 flex flex-col gap-3">
            <h2 className="text-[16px] font-bold text-card-foreground">
              {noteFor.action === 'warn'
                ? t('warnTitle', { name: noteFor.report.reported_user_name })
                : t('banTitle', { name: noteFor.report.reported_user_name })}
            </h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {noteFor.action === 'warn' ? t('warnHint') : t('banHint')}
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={MODERATOR_NOTE_MAX_LENGTH}
              placeholder={
                noteFor.action === 'warn'
                  ? t('warnPlaceholder')
                  : t('banPlaceholder')
              }
              className="bg-input rounded-md px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed w-full"
            />
            {error && <p className="text-[13px] text-destructive">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNoteFor(null)}
                className="flex-1 h-[52px] rounded-md border border-border text-[15px] font-semibold text-card-foreground"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                // A warning with no text would deliver an empty DM — the
                // server rejects it too (validateModeration).
                disabled={
                  busyId !== null ||
                  (noteFor.action === 'warn' && note.trim().length === 0)
                }
                onClick={() =>
                  void runAction(
                    noteFor.report,
                    noteFor.action,
                    note.trim() || null
                  )
                }
                className="flex-1 h-[52px] rounded-md bg-primary text-primary-foreground text-[15px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number | null;
}

function TabButton({ active, onClick, label, count }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[14px] font-semibold border ${
        active
          ? 'bg-secondary border-primary text-secondary-foreground'
          : 'bg-card border-border text-muted-foreground'
      }`}
    >
      {label}
      {count !== null && count > 0 && (
        <span className="min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  );
}

interface ReportCardProps {
  report: MessageReport;
  busy: boolean;
  onAction: (report: MessageReport, action: ModerationAction) => void;
}

function ReportCard({ report, busy, onAction }: ReportCardProps) {
  const t = useTranslations('Moderation');
  const contextHref = reportContextHref(report);
  const isPending = report.status === 'pending';

  return (
    <li className="bg-card border border-border rounded-lg p-3.5 flex flex-col gap-2.5">
      {/* Who + what */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-bold text-card-foreground">
              {report.reported_user_name}
            </span>
            {report.reported_user_banned && (
              <span className="px-2 h-5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center">
                {t('bannedBadge')}
              </span>
            )}
          </div>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            {t('reportedBy', {
              name: report.reporter_name,
              surface: t(`surface_${report.surface}`),
            })}
          </div>
        </div>
        <span className="shrink-0 px-2 py-1 rounded-full bg-input text-[11px] font-bold text-card-foreground">
          {t(`reason_${report.reason}`)}
        </span>
      </div>

      {/* The reported message — a snapshot taken when the report was filed, so
          it still reads correctly after the message itself is deleted. */}
      <div className="px-3 py-2.5 bg-input rounded-xl">
        <p className="text-[14px] text-card-foreground leading-snug whitespace-pre-wrap break-words">
          {report.message_body}
        </p>
      </div>

      {/* The reporter's own words, when they added any */}
      {report.note && (
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          <span className="font-semibold">{t('reporterNote')}: </span>
          {report.note}
        </p>
      )}

      <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
        <time dateTime={report.created_at}>
          {new Date(report.created_at).toLocaleString('da-DK', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
        {contextHref && (
          <Link
            href={contextHref}
            className="flex items-center gap-1 text-secondary-foreground font-semibold"
          >
            <ExternalLink size={13} />
            {t('openContext')}
          </Link>
        )}
      </div>

      {/* Outcome line for already-handled reports */}
      {!isPending && report.resolution && (
        <p className="text-[13px] text-card-foreground">
          <span className="font-semibold">{t('outcome')}: </span>
          {t(`resolution_${report.resolution}`)}
          {report.moderator_note ? ` — ${report.moderator_note}` : ''}
        </p>
      )}

      {/* Actions. Available on handled reports too: a moderator may need to
          escalate after the fact (dismiss now, ban tomorrow). */}
      <div className="flex flex-wrap gap-2 pt-0.5">
        <ActionButton
          label={t('actionDelete')}
          onClick={() => onAction(report, 'delete')}
          disabled={busy}
          variant="destructive"
        />
        {report.reported_user_banned ? (
          <ActionButton
            label={t('actionUnban')}
            onClick={() => onAction(report, 'unban')}
            disabled={busy}
          />
        ) : (
          <ActionButton
            label={t('actionBan')}
            onClick={() => onAction(report, 'ban')}
            disabled={busy}
            variant="destructive"
          />
        )}
        <ActionButton
          label={t('actionWarn')}
          onClick={() => onAction(report, 'warn')}
          disabled={busy}
        />
        {isPending && (
          <ActionButton
            label={t('actionDismiss')}
            onClick={() => onAction(report, 'dismiss')}
            disabled={busy}
          />
        )}
      </div>
    </li>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled: boolean;
  variant?: 'default' | 'destructive';
}

function ActionButton({
  label,
  onClick,
  disabled,
  variant = 'default',
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-10 px-3.5 rounded-md border text-[14px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${
        variant === 'destructive'
          ? 'border-destructive text-destructive bg-card'
          : 'border-border text-card-foreground bg-card'
      }`}
    >
      {label}
    </button>
  );
}
