'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMounted } from '@/lib/hooks/use-mounted';

const STORAGE_KEY = 'pogo-longpress-hint-dismissed';

// One-time hint teaching the long-press gesture (long-press a message to open
// the reply / react / copy sheet — see useLongPress + MessageGroup). There's no
// on-screen affordance for the gesture otherwise. Rendered just above the
// composer until the user dismisses it; the choice persists in localStorage so
// it never reappears. useMounted gates the localStorage read to the client and
// keeps the server/first-client render empty (no hydration mismatch).
export function LongPressHint() {
  const t = useTranslations('Chat');
  const mounted = useMounted();
  const [dismissed, setDismissed] = useState(false);

  if (!mounted || dismissed) return null;
  if (window.localStorage.getItem(STORAGE_KEY)) return null;

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="flex items-center gap-2 px-3.5 py-2 border-b border-border bg-input/40">
      <span className="flex-1 text-[12px] text-muted-foreground leading-snug">
        {t('longPressHint')}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('hintDismiss')}
        className="w-6 h-6 rounded-full bg-input flex items-center justify-center shrink-0 text-card-foreground"
      >
        <X size={12} />
      </button>
    </div>
  );
}
