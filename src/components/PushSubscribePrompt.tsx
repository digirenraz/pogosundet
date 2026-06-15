'use client';

// Banner shown on the raids page prompting PWA users to enable push notifications.
// Only visible when running as an installed standalone PWA and the user hasn't
// yet subscribed or dismissed the prompt.
import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { subscribeToPush, getPushStatus } from '@/lib/push/subscription-helpers';
import { useMounted } from '@/lib/hooks/use-mounted';

const DISMISSED_KEY = 'push-prompt-dismissed';

type PushStatus = 'subscribed' | 'unsubscribed' | 'denied' | 'unsupported';

interface Props {
  userId: string;
}

export function PushSubscribePrompt({ userId }: Props) {
  const mounted = useMounted();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  // Live push state read from the browser's PushManager on the device — NOT the
  // server's `push_subscriptions` DB row. The DB row survives a PWA uninstall,
  // so after the user reinstalls (e.g. to pick up a new icon) it falsely reads
  // "subscribed": the prompt would never show, iOS is never asked for
  // permission, and no notifications arrive. Re-checking the real subscription
  // here means a reinstalled PWA correctly re-offers the prompt. Re-subscribing
  // upserts (onConflict user_id), replacing the now-dead endpoint.
  const [status, setStatus] = useState<PushStatus | null>(null);
  const t = useTranslations('Raids');

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    getPushStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  // Gate all browser-only checks behind `mounted` to avoid SSR mismatch.
  if (!mounted || dismissed) return null;
  // `null` = still checking; only offer when the device genuinely has no live
  // subscription (subscribed/denied/unsupported all hide the prompt).
  if (status !== 'unsubscribed') return null;
  if (localStorage.getItem(DISMISSED_KEY) === '1') return null;
  if (!window.matchMedia('(display-mode: standalone)').matches) return null;

  async function handleAllow() {
    setLoading(true);
    const { error } = await subscribeToPush(userId);
    setLoading(false);
    if (error) {
      console.error('[push] subscribe failed', error);
      return;
    }
    setDismissed(true);
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
