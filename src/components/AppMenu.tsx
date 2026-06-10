'use client';

import { useEffect, useRef, useState } from 'react';
import { Bug, Menu, Newspaper, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ChangelogEntry } from '@/lib/changelog/entries';
import { BugReportSheet } from '@/components/BugReportSheet';

// ---------------------------------------------------------------------------
// ChangelogSheet — bottom sheet listing the user-facing changelog ("Nyheder").
//
// The entries module is loaded via dynamic import() the FIRST time the sheet
// opens — never statically — so the changelog content stays out of the initial
// bundle and the RSC payload (zero impact on page load).
// ---------------------------------------------------------------------------

interface ChangelogSheetProps {
  open: boolean;
  onClose(): void;
}

export function ChangelogSheet({ open, onClose }: ChangelogSheetProps) {
  const t = useTranslations('AppMenu');
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);

  // Lazy-load the entries on first open. The import resolves in milliseconds;
  // until then the list area simply renders empty (no skeleton needed).
  useEffect(() => {
    if (!open || entries !== null) return;
    let cancelled = false;
    import('@/lib/changelog/entries').then((mod) => {
      if (!cancelled) setEntries(mod.CHANGELOG_ENTRIES);
    });
    return () => {
      cancelled = true;
    };
  }, [open, entries]);

  // Escape closes the sheet while it is open.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    /* Backdrop — click outside the sheet closes it */
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Sheet */}
      <div className="bg-card rounded-t-2xl w-full max-w-[480px] mx-auto max-h-[70vh] overflow-y-auto px-4 pt-3.5 pb-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[16px] font-bold text-card-foreground">{t('changelogTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="w-10 h-10 -mr-2 flex items-center justify-center rounded-full text-muted-foreground"
          >
            <X size={20} />
          </button>
        </div>

        {/* Entries */}
        {entries !== null &&
          (entries.length === 0 ? (
            <p className="text-[14px] text-muted-foreground py-4">{t('empty')}</p>
          ) : (
            <ul className="flex flex-col">
              {entries.map((entry, i) => (
                <li
                  key={`${entry.date}-${i}`}
                  className="py-3 border-b border-border last:border-b-0"
                >
                  <div className="text-[12px] text-muted-foreground font-semibold mb-1">
                    {new Date(entry.date).toLocaleDateString('da-DK', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                  <p className="text-[14px] text-card-foreground leading-relaxed">{entry.text}</p>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppMenu — hamburger button at the left edge of the main 60px headers.
// Opens a small anchored dropdown with two items: "Nyheder" → ChangelogSheet
// and "Rapportér en fejl" → BugReportSheet.
// ---------------------------------------------------------------------------

export function AppMenu() {
  const t = useTranslations('AppMenu');
  const tBug = useTranslations('BugReport');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bugSheetOpen, setBugSheetOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Outside-click + Escape close the dropdown.
  useEffect(() => {
    if (!menuOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div ref={rootRef} className="relative mr-1">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={t('menuLabel')}
        aria-expanded={menuOpen}
        className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-card-foreground"
      >
        <Menu size={22} />
      </button>

      {/* Anchored dropdown */}
      {menuOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-card border border-border rounded-xl shadow-lg py-1.5 z-20">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setSheetOpen(true);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[14px] font-semibold text-card-foreground text-left"
          >
            <Newspaper size={18} className="text-muted-foreground" />
            {t('changelog')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setBugSheetOpen(true);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[14px] font-semibold text-card-foreground text-left"
          >
            <Bug size={18} className="text-muted-foreground" />
            {tBug('menuItem')}
          </button>
        </div>
      )}

      <ChangelogSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <BugReportSheet open={bugSheetOpen} onClose={() => setBugSheetOpen(false)} />
    </div>
  );
}
