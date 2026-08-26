'use client';

import { Reply, Copy, Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ChatMessage } from '@/lib/chat/types';

interface MessageActionSheetProps {
  message: ChatMessage | null;
  currentUserId: string;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  /**
   * Opens the report sheet for this message. Optional so a surface that hasn't
   * been wired for moderation yet simply doesn't show the action.
   */
  onReport?: () => void;
}

// Quick reactions shown at the top of the sheet. Order mirrors the design.
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

// Bottom sheet that opens when the user taps a message bubble. Combines a
// quick-reaction row with "Svar" and "Kopiér tekst" actions. Returns null when
// no message is active.
export function MessageActionSheet({
  message,
  currentUserId,
  onClose,
  onReact,
  onReply,
  onCopy,
  onReport,
}: MessageActionSheetProps) {
  const t = useTranslations('Chat');
  if (!message) return null;

  const mine = message.author_id === currentUserId;
  const authorName = mine
    ? t('you')
    : message.profiles?.trainer_name ?? '—';

  // Emojis the current user has already reacted with → highlighted as active.
  const meReactedWith = new Set(
    Object.entries(message.reactions)
      .filter(([, ids]) => ids.includes(currentUserId))
      .map(([emoji]) => emoji)
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        onClick={onClose}
        aria-label={t('closeSheet')}
        className="absolute inset-0 bg-black/30"
      />
      <div className="relative bg-card rounded-t-3xl pb-[18px] shadow-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1.5">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>

        {/* Echo the message being acted on */}
        <div className="mx-4 mt-1.5 mb-3.5 px-3 py-2.5 bg-input rounded-xl flex flex-col gap-0.5">
          <span className="text-[11px] font-bold text-card-foreground tracking-[0.02em]">
            {authorName}
          </span>
          <span className="text-[13px] text-muted-foreground leading-snug line-clamp-2">
            {message.body}
          </span>
        </div>

        {/* Quick reaction row */}
        <div className="flex gap-2 px-4 pb-3">
          {QUICK_EMOJIS.map((e) => {
            const active = meReactedWith.has(e);
            return (
              <button
                key={e}
                type="button"
                onClick={() => onReact(e)}
                className={`flex-1 h-11 rounded-xl border text-[22px] leading-none flex items-center justify-center ${
                  active
                    ? 'border-primary bg-secondary'
                    : 'border-border bg-card'
                }`}
              >
                {e}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="px-2 flex flex-col">
          <ActionRow icon="reply" label={t('actionSvar')} onClick={onReply} />
          <ActionRow icon="copy" label={t('actionKopier')} onClick={onCopy} />
          {/* Reporting your own message is meaningless (and rejected by the
              report_message RPC), so the action only appears on others'. */}
          {onReport && !mine && (
            <ActionRow
              icon="report"
              label={t('actionAnmeld')}
              onClick={onReport}
              destructive
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface ActionRowProps {
  icon: 'reply' | 'copy' | 'report';
  label: string;
  onClick: () => void;
  /** Renders the row in the destructive colour — used by "Anmeld". */
  destructive?: boolean;
}

const ACTION_ICONS = { reply: Reply, copy: Copy, report: Flag } as const;

function ActionRow({ icon, label, onClick, destructive = false }: ActionRowProps) {
  const Icon = ACTION_ICONS[icon];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3.5 px-3 py-3 rounded-[10px] bg-transparent text-[15px] font-semibold text-left ${
        destructive ? 'text-destructive' : 'text-card-foreground'
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );
}
