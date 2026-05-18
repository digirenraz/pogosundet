'use client';

import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/Avatar';
import { clockTime, type MessageGroup as MessageGroupType } from '@/lib/chat/time';
import type { ChatMessage } from './ChannelScreen';

interface MessageGroupProps {
  group: MessageGroupType<ChatMessage>;
  mine: boolean;
  isLastOwnGroup: boolean;
}

interface MessageBubbleProps {
  body: string;
  mine: boolean;
  isFirst: boolean;
  isLast: boolean;
}

// Single chat bubble. Group-aware corner rounding so consecutive bubbles
// from the same author read as one shape.
function MessageBubble({ body, mine, isFirst, isLast }: MessageBubbleProps) {
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
    <div
      className={`px-3.5 py-2 text-[15px] leading-snug max-w-[78%] w-fit break-words ${
        mine ? 'bg-primary text-primary-foreground' : 'bg-input text-card-foreground'
      }`}
      style={{
        borderTopLeftRadius: radius.topLeft,
        borderTopRightRadius: radius.topRight,
        borderBottomRightRadius: radius.bottomRight,
        borderBottomLeftRadius: radius.bottomLeft,
      }}
    >
      {body}
    </div>
  );
}

// One author's consecutive bubbles. Renders a "Sendt · 14:32" line below the
// final own group only — mirrors Messenger's read-receipt position.
export function MessageGroupView({ group, mine, isLastOwnGroup }: MessageGroupProps) {
  const t = useTranslations('Chat');
  const first = group.messages[0];
  const last = group.messages[group.messages.length - 1];
  const author = first.profiles;

  if (mine) {
    return (
      <div className="flex flex-col items-end gap-0.5 mt-1.5">
        {group.messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            body={m.body}
            mine
            isFirst={i === 0}
            isLast={i === group.messages.length - 1}
          />
        ))}
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
        {group.messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            body={m.body}
            mine={false}
            isFirst={i === 0}
            isLast={i === group.messages.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
