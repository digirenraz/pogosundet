'use client';

import { useState, useRef } from 'react';
import { SendHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ComposerProps {
  channelName: string;
  onSend: (body: string) => Promise<void> | void;
  onTyping?: () => void;
}

// Text composer at the bottom of the channel screen. Submits on Enter (no
// shift), grows with content, and fires onTyping (throttled by the consumer).
export function Composer({ channelName, onSend, onTyping }: ComposerProps) {
  const t = useTranslations('Chat');
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasText = value.trim().length > 0;

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
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-3 pt-2.5 pb-3.5 flex items-end gap-2 z-10">
      <div className="flex-1 min-w-0 min-h-10 bg-input border border-border rounded-3xl px-3.5 py-1 flex items-center">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={t('composerPlaceholder', { channel: channelName })}
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
  );
}
