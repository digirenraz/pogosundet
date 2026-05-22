'use client';

import { SmilePlus } from 'lucide-react';

interface ReactionsProps {
  // Pre-grouped: emoji → user_id[]. Stable order = insertion order.
  reactions: Record<string, string[]>;
  // Side the bubble is on. Controls justify-end vs justify-start in parent.
  mine: boolean;
  currentUserId: string;
  onToggle: (emoji: string) => void;
  onAdd: () => void;
}

// Chip row rendered below a message bubble. Reactions the current user has
// placed are highlighted teal; others use the muted card chip style. The
// trailing "+" button opens the action sheet so the user can pick another
// emoji.
export function Reactions({
  reactions,
  mine,
  currentUserId,
  onToggle,
  onAdd,
}: ReactionsProps) {
  const entries = Object.entries(reactions).filter(
    ([, ids]) => ids && ids.length > 0
  );
  if (entries.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap gap-1 mt-1 max-w-[92%] ${
        mine ? 'justify-end' : 'justify-start'
      }`}
    >
      {entries.map(([emoji, ids]) => {
        const meReacted = ids.includes(currentUserId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(emoji);
            }}
            className={`inline-flex items-center gap-1 h-6 pl-1.5 pr-2 rounded-full border text-[12px] font-semibold leading-none ${
              meReacted
                ? 'border-primary bg-secondary text-primary'
                : 'border-border bg-card text-card-foreground'
            }`}
          >
            <span className="text-[13px]">{emoji}</span>
            <span className="tabular-nums">{ids.length}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="inline-flex items-center justify-center w-[26px] h-6 rounded-full border border-border bg-card text-muted-foreground"
        aria-label="Add reaction"
      >
        <SmilePlus size={12} />
      </button>
    </div>
  );
}
