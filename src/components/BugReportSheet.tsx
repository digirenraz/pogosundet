'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  validateBugReport,
  BUG_REPORT_TITLE_MIN,
  BUG_REPORT_TITLE_MAX,
  BUG_REPORT_DESCRIPTION_MIN,
  BUG_REPORT_DESCRIPTION_MAX,
} from '@/lib/bug-report/validation';

// ---------------------------------------------------------------------------
// BugReportSheet — bottom sheet with a title + description form that POSTs to
// /api/bug-report (which creates a private GitHub issue server-side). Opened
// from the AppMenu hamburger dropdown ("Rapportér en fejl"). Same sheet chrome
// as ChangelogSheet in AppMenu.tsx: backdrop click + Escape close, X button,
// max-w-[480px] bottom sheet.
// ---------------------------------------------------------------------------

type Status = 'idle' | 'sending' | 'success' | 'error';

interface BugReportSheetProps {
  open: boolean;
  onClose(): void;
}

export function BugReportSheet({ open, onClose }: BugReportSheetProps) {
  const t = useTranslations('BugReport');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  // After a successful send, closing the sheet resets the form so the next
  // open starts fresh. Done in the close handler (not an effect) — React 19's
  // set-state-in-effect lint rule disallows the effect-based reset pattern.
  const handleClose = useCallback(() => {
    if (status === 'success') {
      setTitle('');
      setDescription('');
      setStatus('idle');
    }
    onClose();
  }, [status, onClose]);

  // Escape closes the sheet while it is open.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  const validation = validateBugReport({ title, description });
  const canSend = validation.ok && status !== 'sending';

  // Live "why is Send disabled?" hints — a disabled button that silently
  // ignores taps reads as "broken" on a phone (prod report 2026-06-10), so
  // each too-short field explains itself as soon as the user starts typing.
  const titleTooShort = title.trim().length > 0 && title.trim().length < BUG_REPORT_TITLE_MIN;
  const descriptionTooShort =
    description.trim().length > 0 && description.trim().length < BUG_REPORT_DESCRIPTION_MIN;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateBugReport({ title, description });
    if (!result.ok || status === 'sending') return;

    setStatus('sending');
    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: result.title, description: result.description }),
      });
      setStatus(res.ok ? 'success' : 'error');
    } catch {
      // Network failure — keep the typed values so nothing is lost.
      setStatus('error');
    }
  }

  // Portal to document.body — the AppMenu callers live inside fixed z-10
  // headers whose stacking context would cap the sheet's z-50, letting the
  // BottomNav (also z-10, later in the DOM) paint over the send button.
  // See ChangelogSheet in AppMenu.tsx for the same fix.
  return createPortal(
    /* Backdrop — click outside the sheet closes it */
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Sheet */}
      <div className="bg-card rounded-t-2xl w-full max-w-[480px] mx-auto max-h-[85vh] overflow-y-auto px-4 pt-3.5 pb-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[16px] font-bold text-card-foreground">{t('sheetTitle')}</h2>
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
            <p className="text-[16px] font-bold text-card-foreground">{t('successTitle')}</p>
            <p className="text-[14px] text-muted-foreground leading-relaxed">{t('successBody')}</p>
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
            {/* Title */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="bug-report-title"
                className="text-[14px] font-semibold text-card-foreground"
              >
                {t('titleLabel')}
              </label>
              <input
                id="bug-report-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
                maxLength={BUG_REPORT_TITLE_MAX}
                className="min-h-[52px] bg-input rounded-md px-4 text-[15px] text-foreground placeholder:text-muted-foreground outline-none w-full"
              />
              {titleTooShort && (
                <p className="text-[13px] text-destructive">
                  {t('titleTooShort', { min: BUG_REPORT_TITLE_MIN })}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="bug-report-description"
                className="text-[14px] font-semibold text-card-foreground"
              >
                {t('descriptionLabel')}
              </label>
              <textarea
                id="bug-report-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                rows={5}
                maxLength={BUG_REPORT_DESCRIPTION_MAX}
                className="bg-input rounded-md px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed w-full"
              />
              {descriptionTooShort && (
                <p className="text-[13px] text-destructive">
                  {t('descriptionTooShort', { min: BUG_REPORT_DESCRIPTION_MIN })}
                </p>
              )}
            </div>

            {/* GDPR disclaimer — the report goes to our private GitHub tracker */}
            <p className="text-[12px] text-muted-foreground leading-relaxed">{t('disclaimer')}</p>

            {/* Inline error — form stays, typed values preserved */}
            {status === 'error' && (
              <p className="text-[13px] text-destructive">{t('errorGeneric')}</p>
            )}

            <button
              type="submit"
              disabled={!canSend}
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
