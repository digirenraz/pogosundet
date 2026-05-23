// Shared chat-message shape consumed by `MessageGroupView`, `Composer`,
// `MessageActionSheet`, and `ReplyQuote`. Lives outside the channel-specific
// directory so both channel chat (`ChannelScreen`) and raid chat
// (`RaidDetail`) can feed the same components without a circular import.
//
// `sent_at` is a Date (the grouping helper expects a Date), `body` is the
// already-canonicalised message text (raid chat maps from its own `message`
// column at the boundary), and `reactions` is pre-grouped via
// `groupReactions(...)` so the renderer can stay synchronous.
export interface ChatMessage {
  id: string;
  author_id: string;
  body: string;
  sent_at: Date;
  reply_to_id: string | null;
  reactions: Record<string, string[]>;
  profiles: {
    trainer_name: string;
    avatar_url: string | null;
    team: 'mystic' | 'valor' | 'instinct' | null;
    level: number | null;
  } | null;
}
