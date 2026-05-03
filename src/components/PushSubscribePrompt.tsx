'use client';

// Banner shown on the raids page prompting PWA users to enable push notifications.
// Only visible when running as an installed standalone PWA and the user hasn't
// yet subscribed or dismissed the prompt.
import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { subscribeToPush } from '@/lib/push/subscription-helpers';

const DISMISSED_KEY = 'push-prompt-dismissed';

interface Props {
  userId: string;
  initialStatus: 'subscribed' | 'unsubscribed' | 'denied' | 'unsupported';
}

export function PushSubscribePrompt({ userId, initialStatus }: Props) {
  // null = not yet determined; false = hide; true = show
  const [visible, setVisible] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const t = useTranslations('Raids');

  useEffect(() => {
    // Only show for unsubscribed users running the standalone PWA who haven't dismissed
    if (initialStatus !== 'unsubscribed') {
      setVisible(false);
      return;
    }
    if (localStorage.getItem(DISMISSED_KEY) === '1') {
      setVisible(false);
      return;
    }
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setVisible(isStandalone);
  }, [initialStatus]);

  // Avoid SSR mismatch — render nothing until the client check is done
  if (visible === null || visible === false) return null;

  async function handleAllow() {
    setLoading(true);
    const { error } = await subscribeToPush(userId);
    setLoading(false);
    if (!error) {
      setVisible(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
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
