'use client';

import { useTranslations } from 'next-intl';
import { EyeOff } from 'lucide-react';

interface FriendCodeHiddenProps {
  /** Square side length in px — matches the FriendCodeQR size it replaces. */
  size?: number;
}

// Blurred placeholder shown in place of another user's friend code / QR when
// they've enabled "hide my friend code" (issue #101). The real value is already
// withheld server-side (redactHiddenFriendCodes), so this is purely the visual
// stand-in: a frosted box with "Ønsker ikke nye venner lige nu" on top.
export function FriendCodeHidden({ size = 224 }: FriendCodeHiddenProps) {
  const t = useTranslations('FriendCode');
  return (
    <div
      className="relative overflow-hidden rounded-md border border-border"
      style={{ width: size, height: size }}
      role="img"
      aria-label={t('hiddenLabel')}
    >
      {/* Frosted, blurred faux-QR backdrop — decorative only. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 blur-md opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, var(--color-muted-foreground) 0 6px, transparent 6px 12px), repeating-linear-gradient(90deg, var(--color-muted-foreground) 0 6px, transparent 6px 12px)',
        }}
      />
      <div className="absolute inset-0 bg-background/40" aria-hidden="true" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <EyeOff size={24} className="text-muted-foreground" aria-hidden="true" />
        <span className="text-[13px] font-semibold text-card-foreground leading-snug">
          {t('hiddenLabel')}
        </span>
      </div>
    </div>
  );
}
