'use client';

// Banner shown on the raids page prompting PWA users to enable push notifications.
// Only visible when running as an installed standalone PWA and the user hasn't
// yet subscribed or dismissed the prompt.
import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { subscribeToPush } from '@/lib/push/subscription-helpers';
import { useMounted } from '@/lib/hooks/use-mounted';

const DISMISSED_KEY = 'push-prompt-dismissed';

interface Props {
  userId: string;
  initialStatus: 'subscribed' | 'unsubscribed' | 'denied' | 'unsupported';
}

export function PushSubscribePrompt({ userId, initialStatus }: Props) {
  const mounted = useMounted();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const t = useTranslations('Raids');

  // Gate all browser-only checks behind `mounted` to avoid SSR mismatch.
  if (!mounted || dismissed) return null;
  if (initialStatus !== 'unsubscribed') return null;
  if (localStorage.getItem(DISMISSED_KEY) === '1') return null;
  if (!window.matchMedia('(display-mode: standalone)').matches) return null;

  async function handleAllow() {
    setLoading(true);
    const { error } = await subscribeToPush(userId);
    setLoading(false);
    if (!error) setDismissed(true);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="bg-secondary border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3">
      {/* Bell icon */}
      <Bell size={20} className="text-primary flex-shrink-0" />

      {/* Text */}
      <div className="flex-1">
        <p className="text-[14px] font-bold text-card-foreground">
          {t('pushPrompt.title')}
        </p>
        <p className="text-[12px] text-muted-foreground">
          {t('pushPrompt.subtitle')}
        </p>
      </div>

      {/* Allow button */}
      <button
        onClick={handleAllow}
        disabled={loading}
        className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-[13px] font-bold disabled:opacity-60 flex-shrink-0"
      >
        {t('pushPrompt.allow')}
      </button>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        aria-label="Luk"
        className="text-muted-foreground flex-shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}
