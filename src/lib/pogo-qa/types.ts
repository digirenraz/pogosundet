// Constants and types for the Q&A bot — the "!pogo <spørgsmål>" half of the
// event-bot brief. The #events poller (src/lib/pogo-feed/) announces; this
// answers.
//
// Kept free of imports from ./limits, ./answer etc. on purpose: the client
// bundle imports QA_TRIGGER / QA_CHANNELS / MAX_QUESTION_LENGTH to decide
// whether a composed message is a bot question, and must not drag the Anthropic
// SDK or the admin Supabase client along with it.

/**
 * The prefix that turns a chat message into a question for the bot.
 *
 * An explicit trigger rather than an @mention or a dedicated channel: chat has
 * no command dispatch today, and a visible prefix makes it obvious to everyone
 * in the channel that the answer came from a bot and that the question left the
 * app. See `parseQuestion` in ./trigger.ts for the exact matching rules.
 */
export const QA_TRIGGER = '!pogo';

/**
 * Channels where the bot answers.
 *
 * #generelt is where people actually ask these questions; #events is the bot's
 * own channel. #feedback is deliberately excluded — that channel is for app
 * bugs the PM reads, and bot chatter there would bury real reports.
 *
 * Widening this is a one-line change here. Note it is a SUBSET of ChannelId in
 * src/lib/chat/channels.ts, not a mirror of it — `isQaChannel` below is the
 * only thing that should ever test membership.
 */
export const QA_CHANNELS = ['generelt', 'events'] as const;

export type QaChannel = (typeof QA_CHANNELS)[number];

/** Does the bot answer questions in this channel? */
export function isQaChannel(id: string): id is QaChannel {
  return (QA_CHANNELS as readonly string[]).includes(id);
}

/**
 * Longest question we forward to the model.
 *
 * Well under CHAT_MESSAGE_MAX_LENGTH (2000): a genuine Pokémon GO question is a
 * sentence or two, and the remaining 1500 characters are only useful to somebody
 * trying to smuggle a prompt-injection payload or run up the input-token bill.
 */
export const MAX_QUESTION_LENGTH = 500;

// ─── Rate limits ─────────────────────────────────────────────────────────────
//
// Three layers guard the spend, and these are only the first two. The one that
// actually protects the card is the spend limit set in the Anthropic Console,
// because it survives a bug in this file. See docs/plans/pogo-qa-bot.md.
//
// These numbers are sized for a community of a few dozen players where the
// realistic steady state is a handful of questions a day. They exist for the
// pathological case — a bored member, or a loop in a future client — not for
// normal use, so they should never bite anyone asking in good faith.

/** Per-member questions allowed in any rolling hour. */
export const USER_LIMIT_PER_HOUR = 5;

/** Per-member questions allowed in any rolling 24 hours. */
export const USER_LIMIT_PER_DAY = 20;

/** Questions allowed across the whole community in any rolling 24 hours. */
export const GLOBAL_LIMIT_PER_DAY = 150;

/** Which ceiling a refused question hit. Surfaced to the client so it can say. */
export type RateLimitScope = 'user' | 'global';

export interface RateLimitResult {
  allowed: boolean;
  scope?: RateLimitScope;
}

// ─── Answering ───────────────────────────────────────────────────────────────

/** Token and search usage for one answer. Logged to bot_questions. */
export interface AnswerUsage {
  inputTokens: number;
  outputTokens: number;
  webSearches: number;
}

/**
 * The outcome of one call to the model.
 *
 * A discriminated union rather than a throw, matching FeedResult in
 * src/lib/pogo-feed/types.ts: every failure mode here is expected and
 * recoverable (the route posts a Danish apology), so none of them should unwind
 * the request.
 *
 * `reason` is a short slug for the log, never shown to a member.
 */
export type AnswerResult =
  | { ok: true; text: string; usage: AnswerUsage }
  | { ok: false; reason: string };
