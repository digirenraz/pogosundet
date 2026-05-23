'use client';

import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/Avatar';
import { clockTime, type MessageGroup as MessageGroupType } from '@/lib/chat/time';
import type { ChatMessage } from '@/lib/chat/types';
import { Reactions } from './Reactions';
import { ReplyQuote } from './ReplyQuote';

interface MessageGroupProps {
  group: MessageGroupType<ChatMessage>;
  mine: boolean;
  isLastOwnGroup: boolean;
  messagesById: Record<string, ChatMessage>;
  currentUserId: string;
  highlightedId: string | null;
  onTap: (message: ChatMessage) => void;
  onReactToggle: (messageId: string, emoji: string) => void;
}

interface MessageBubbleProps {
  body: string;
  mine: boolean;
  isFirst: boolean;
  isLast: boolean;
  dimmed: boolean;
  onTap: () => void;
}

// Single chat bubble — clickable so taps open the action sheet. Group-aware
// corner rounding so consecutive bubbles from the same author read as one
// shape; the first/last flags also account for reply quotes and reaction rows
// breaking the visual grouping.
function MessageBubble({
  body,
  mine,
  isFirst,
  isLast,
  dimmed,
  onTap,
}: MessageBubbleProps) {
  const r = 16;
  const tight = 4;
  const radius = mine
    ? {
        topLeft: r,
        topRight: isFirst ? r : tight,
        bottomRight: isLast ? r : tight,
        bottomLeft: r,
      }
    : {
        topLeft: isFirst ? r : tight,
        topRight: r,
        bottomRight: r,
        bottomLeft: isLast ? r : tight,
      };

  return (
    <button
      type="button"
      onClick={onTap}
      className={`px-3.5 py-2 text-[15px] leading-snug max-w-[78%] w-fit break-words text-left transition-opacity ${
        mine ? 'bg-primary text-primary-foreground' : 'bg-input text-card-foreground'
      } ${dimmed ? 'opacity-50' : 'opacity-100'}`}
      style={{
        borderTopLeftRadius: radius.topLeft,
        borderTopRightRadius: radius.topRight,
        borderBottomRightRadius: radius.bottomRight,
        borderBottomLeftRadius: radius.bottomLeft,
      }}
    >
      {body}
    </button>
  );
}

// One author's consecutive bubbles. Reply quotes render above the bubble they
// belong to; reaction chips render below. A reply quote OR a reactions row
// counts as a corner-rounding "break" so adjacent bubbles in the same group
// still read correctly.
export function MessageGroupView({
  group,
  mine,
  isLastOwnGroup,
  messagesById,
  currentUserId,
  highlightedId,
  onTap,
  onReactToggle,
}: MessageGroupProps) {
  const t = useTranslations('Chat');
  const first = group.messages[0];
  const last = group.messages[group.messages.length - 1];
  const author = first.profiles;

  function renderMessageRows(mineFlag: boolean) {
    return group.messages.map((m, i) => {
      const original = m.reply_to_id ? messagesById[m.reply_to_id] : null;
      const hasReactions = Object.keys(m.reactions).length > 0;
      const prev = group.messages[i - 1];
      const isFirst = i === 0 || Boolean(prev?.reply_to_id) || Boolean(original);
      const isLast = i === group.messages.length - 1 || hasReactions;
      const dimmed = Boolean(highlightedId && highlightedId !== m.id);

      const replyAuthorName = original
        ? original.author_id === currentUserId
          ? t('you_lowercase')
          : original.profiles?.trainer_name ?? '—'
        : '';

      return (
        <div key={m.id} className="flex flex-col w-full gap-0.5">
          {original && (
            <div
              className={`flex w-full ${
                mineFlag ? 'justify-end' : 'justify-start'
              }`}
            >
              <ReplyQuote
                authorName={replyAuthorName}
                body={original.body}
                mine={mineFlag}
              />
            </div>
          )}
          <div
            className={`flex w-full ${
              mineFlag ? 'justify-end' : 'justify-start'
            }`}
          >
            <MessageBubble
              body={m.body}
              mine={mineFlag}
              isFirst={isFirst}
              isLast={isLast}
              dimmed={dimmed}
              onTap={() => onTap(m)}
            />
          </div>
          {hasReactions && (
            <div
              className={`flex w-full ${
                mineFlag ? 'justify-end' : 'justify-start'
              }`}
            >
              <Reactions
                reactions={m.reactions}
                mine={mineFlag}
                currentUserId={currentUserId}
                onToggle={(emoji) => onReactToggle(m.id, emoji)}
                onAdd={() => onTap(m)}
              />
            </div>
          )}
        </div>
      );
    });
  }

  if (mine) {
    return (
      <div className="flex flex-col items-end gap-0.5 mt-1.5">
        {renderMessageRows(true)}
        {isLastOwnGroup && (
          <span className="text-[11px] font-semibold text-muted-foreground mt-1">
            {t('sentAt', { time: clockTime(last.sent_at) })}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-2 mt-1.5">
      <div className="shrink-0 w-8 pt-[18px]">
        <Avatar
          src={author?.avatar_url ?? null}
          name={author?.trainer_name ?? '?'}
          team={author?.team ?? 'none'}
          size={32}
          ring={false}
        />
      </div>
      <div className="flex flex-col gap-0.5 items-start min-w-0 flex-1">
        <div className="flex items-baseline gap-2 px-1">
          <span className="text-[13px] font-bold text-card-foreground whitespace-nowrap">
            {author?.trainer_name ?? '—'}
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
            {clockTime(first.sent_at)}
          </span>
        </div>
        {renderMessageRows(false)}
      </div>
    </div>
  );
}
