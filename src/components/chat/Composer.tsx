'use client';

import { useState, useRef } from 'react';
import { Reply, SendHorizontal, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CHAT_MESSAGE_MAX_LENGTH, type ChatMessage } from '@/lib/chat/types';
import { LongPressHint } from './LongPressHint';

interface ComposerProps {
  channelName: string;
  onSend: (body: string) => Promise<void> | void;
  onTyping?: () => void;
  // Reply state — owned by ChannelScreen, passed in for presentation.
  replyTo?: ChatMessage | null;
  // Resolved name to show in the banner ("dig" for self, otherwise trainer name).
  replyToName?: string;
  onCancelReply?: () => void;
}

// Text composer at the bottom of the channel screen. Submits on Enter (no
// shift), grows with content, and fires onTyping (throttled by the consumer).
// Renders a reply preview banner above the textarea when replyTo is set.
export function Composer({
  channelName,
  onSend,
  onTyping,
  replyTo,
  replyToName,
  onCancelReply,
}: ComposerProps) {
  const t = useTranslations('Chat');
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasText = value.trim().length > 0;
  const isReplying = Boolean(replyTo);
  const placeholder = isReplying
    ? t('replyPlaceholder', { name: replyToName ?? '' })
    : t('composerPlaceholder', { channel: channelName });

  async function handleSend() {
    const body = value.trim();
    if (!body || sending) return;
    setSending(true);
    setValue('');
    try {
      await onSend(body);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    if (e.target.value.length > 0 && onTyping) onTyping();
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-10 flex flex-col">
      {!isReplying && <LongPressHint />}
      {isReplying && replyTo && (
        <div className="flex items-start gap-2.5 px-3.5 pt-2.5 pb-2 border-b border-border">
          <Reply
            size={16}
            className="text-primary mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="text-[12px] font-bold text-primary tracking-[0.02em]">
              {t('replyingTo', { name: replyToName ?? '' })}
            </span>
            <span className="text-[13px] text-muted-foreground leading-snug line-clamp-1">
              {replyTo.body}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label={t('cancelReply')}
            className="w-7 h-7 rounded-full bg-input flex items-center justify-center shrink-0 text-card-foreground"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="px-3 pt-2.5 pb-3.5 flex items-end gap-2">
        <div className="flex-1 min-w-0 min-h-10 bg-input border border-border rounded-3xl px-3.5 py-1 flex items-center">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            rows={1}
            placeholder={placeholder}
            className="flex-1 bg-transparent border-0 outline-none resize-none text-[15px] text-card-foreground placeholder:text-muted-foreground py-1.5 max-h-[120px]"
          />
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={!hasText || sending}
          aria-label={t('send')}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            hasText
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <SendHorizontal size={18} />
        </button>
      </div>
    </div>
  );
}
