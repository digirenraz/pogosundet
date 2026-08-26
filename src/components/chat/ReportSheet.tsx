'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { reportMessage } from '@/lib/moderation/helpers';
import { validateReport } from '@/lib/moderation/validation';
import {
  REPORT_NOTE_MAX_LENGTH,
  REPORT_REASONS,
  type ReportReason,
  type ReportSurface,
} from '@/lib/moderation/types';
import type { ChatMessage } from '@/lib/chat/types';

// ---------------------------------------------------------------------------
// ReportSheet — bottom sheet for reporting a single message to the moderators.
//
// Opened from MessageActionSheet's "Anmeld" row on all three chat surfaces
// (channel, raid, DM). Same sheet chrome as BugReportSheet: portal to
// document.body, backdrop click + Escape close, max-w-[480px].
//
// The sheet never sends the message text — reportMessage() passes only the
// message id, and the server snapshots the body itself. See
// src/lib/moderation/helpers.ts for why that matters.
// ---------------------------------------------------------------------------

type Status = 'idle' | 'sending' | 'success' | 'error';

interface ReportSheetProps {
  /** The message being reported, or null when the sheet is closed. */
  message: ChatMessage | null;
  surface: ReportSurface;
  onClose(): void;
}

export function ReportSheet({ message, surface, onClose }: ReportSheetProps) {
  const t = useTranslations('Report');
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0]);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorKind, setErrorKind] = useState<'not_found' | 'generic'>('generic');

  // Reset on close rather than in an effect — React 19's set-state-in-effect
  // rule disallows the effect-based reset pattern (see BugReportSheet).
  const handleClose = useCallback(() => {
    setReason(REPORT_REASONS[0]);
    setNote('');
    setStatus('idle');
    setErrorKind('generic');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!message) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [message, handleClose]);

  if (!message) return null;

  const authorName = message.profiles?.trainer_name ?? '—';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message || status === 'sending') return;

    // Validate before hitting the network. The RPC enforces all of this again
    // server-side (CHECK constraints + RAISE EXCEPTION) — this pass just turns
    // the cases we can detect locally, most usefully an optimistic `opt-` id
    // that has no server-side row yet, into an inline error instead of a
    // round trip that fails.
    const validation = validateReport({
      surface,
      messageId: message.id,
      reason,
      note,
    });
    if (!validation.ok) {
      setErrorKind(validation.error === 'messageId' ? 'not_found' : 'generic');
      setStatus('error');
      return;
    }

    setStatus('sending');
    const result = await reportMessage(
      validation.surface,
      validation.messageId,
      validation.reason,
      validation.note
    );
    if (result.ok) {
      setStatus('success');
      return;
    }
    // A message deleted between opening the sheet and submitting is worth
    // wording differently — the user has done nothing wrong and there is
    // nothing left to report.
    setErrorKind(result.reason === 'not_found' ? 'not_found' : 'generic');
    setStatus('error');
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-card rounded-t-2xl w-full max-w-[480px] mx-auto max-h-[85vh] overflow-y-auto px-4 pt-3.5 pb-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[16px] font-bold text-card-foreground">
            {t('sheetTitle')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('close')}
            className="w-10 h-10 -mr-2 flex items-center justify-center rounded-full text-muted-foreground"
          >
            <X size={20} />
          </button>
        </div>

        {status === 'success' ? (
          /* Thank-you state — replaces the form after a successful send */
          <div className="flex flex-col gap-3 py-4">
            <p className="text-[16px] font-bold text-card-foreground">
              {t('successTitle')}
            </p>
            <p className="text-[14px] text-muted-foreground leading-relaxed">
              {t('successBody')}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="h-[52px] w-full mt-2 bg-primary text-primary-foreground rounded-md flex items-center justify-center text-base font-semibold"
            >
              {t('close')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Echo the message being reported so there's no doubt which one */}
            <div className="px-3 py-2.5 bg-input rounded-xl flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-card-foreground tracking-[0.02em]">
                {authorName}
              </span>
              <span className="text-[13px] text-muted-foreground leading-snug line-clamp-3">
                {message.body}
              </span>
            </div>

            {/* Reason — radio group */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-[14px] font-semibold text-card-foreground mb-2">
                {t('reasonLabel')}
              </legend>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-3 px-3.5 min-h-[48px] rounded-md border cursor-pointer ${
                    reason === r
                      ? 'border-primary bg-secondary'
                      : 'border-border bg-card'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-[var(--color-primary)] w-4 h-4"
                  />
                  <span className="text-[15px] text-card-foreground">
                    {t(`reason_${r}`)}
                  </span>
                </label>
              ))}
            </fieldset>

            {/* Optional free-text note */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="report-note"
                className="text-[14px] font-semibold text-card-foreground"
              >
                {t('noteLabel')}
              </label>
              <textarea
                id="report-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('notePlaceholder')}
                rows={3}
                maxLength={REPORT_NOTE_MAX_LENGTH}
                className="bg-input rounded-md px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed w-full"
              />
            </div>

            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {t('disclaimer')}
            </p>

            {status === 'error' && (
              <p className="text-[13px] text-destructive">
                {errorKind === 'not_found' ? t('errorGone') : t('errorGeneric')}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="h-[52px] w-full bg-primary text-primary-foreground rounded-md flex items-center justify-center text-base font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
            >
              {status === 'sending' ? t('sending') : t('send')}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
