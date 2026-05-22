'use client';

import { useTranslations } from 'next-intl';

interface ReplyQuoteProps {
  authorName: string;
  body: string;
  // Side the reply bubble is on. Determines which side the accent bar sits on.
  mine: boolean;
}

// Quoted preview shown above a reply bubble. Accent bar flips side based on
// whether the reply is mine — so the bar always points at the bubble below.
export function ReplyQuote({ authorName, body, mine }: ReplyQuoteProps) {
  const t = useTranslations('Chat');
  return (
    <div
      className={`max-w-[78%] w-fit min-w-0 px-2.5 py-1.5 bg-input rounded-xl mb-1 flex flex-col gap-0.5 opacity-95 ${
        mine ? 'border-r-[3px] border-primary' : 'border-l-[3px] border-primary'
      }`}
    >
      <span className="text-[11px] font-bold text-primary tracking-[0.02em]">
        {t('replyingTo', { name: authorName })}
      </span>
      <span className="text-[12px] text-muted-foreground leading-snug line-clamp-1">
        {body}
      </span>
    </div>
  );
}
