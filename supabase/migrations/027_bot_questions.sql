-- Migration 027: the Q&A bot's rate-limit ledger.
--
-- The #events poster (023) is one-way — it announces, it cannot be asked
-- anything. This is the second half of that brief: a member types
-- "!pogo <spørgsmål>" in #generelt or #events and the bot answers in the
-- channel, quoting the question. The answer comes from an LLM (Anthropic), so
-- unlike the poller this feature costs real money per invocation and reaches a
-- third-party processor outside the EU.
--
-- This table exists for exactly two reasons:
--
-- 1. RATE LIMITING. The poller's anti-spam is a per-run array slice
--    (MAX_POSTS_PER_RUN in src/lib/pogo-feed/diff.ts) — it works because that
--    bot is a scheduled batch job with a ledger. A !pogo bot is event-driven
--    per user message, so it needs a real per-user counter. There was no rate
--    limiting anywhere in this codebase before this migration.
--
-- 2. SPEND VISIBILITY. Token counts per answer, so "what is this costing?" is a
--    SQL query rather than a guess.
--
-- NO QUESTION TEXT IS STORED, deliberately. The question already lives in
-- channel_messages as an ordinary chat message that the member can see and that
-- disappears with their account. Copying it here would be a second copy of
-- personal data serving no purpose that the first copy doesn't already serve —
-- the same reasoning that removed the always-null `accuracy_m` column from the
-- live-locations schema during that slice's /gdpr-check. Counting rows is all
-- the rate limiter needs.
--
-- Apply-before-merge ordering (like 015/017/018/020/021/023): the route queries
-- this table on the very first !pogo message, so prod errors the moment the code
-- deploys if it has not been applied first. Run in the Supabase SQL editor on
-- BOTH prod and pogosundet-preview.

CREATE TABLE public.bot_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ON DELETE CASCADE, and deliberately only ONE foreign key.
  --
  -- Migration 025 had to repair five constraints that pointed a second FK at
  -- profiles(user_id) purely so PostgREST could embed profiles(trainer_name).
  -- Those gave account deletion two independent cascade paths off the same
  -- auth.users row, and whichever lost the race threw a foreign key violation.
  -- Nothing embeds a profile here — the rate limiter only ever counts rows — so
  -- there is no reason to add that second FK, and every reason not to.
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Note what is NOT here: no question text, and no channel.
  --
  -- A `channel` column was in the first draft and was removed by /gdpr-check
  -- before this ever ran. Nothing read it — the rate limiter counts by user and
  -- time only — and combined with user_id and asked_at it would have described
  -- where a named member was active and when, collected for no purpose that
  -- anything served. Same reasoning that removed the always-null `accuracy_m`
  -- column from the live-locations schema. The channel is still in the route's
  -- log line and its Sentry context, which is where it was actually useful.
  asked_at      timestamptz NOT NULL DEFAULT now(),

  -- Nullable: a failed or refused answer still gets logged for rate-limiting
  -- purposes, and there may be no usage figures to record for it.
  input_tokens  integer,
  output_tokens integer,

  -- Server-side web searches the answer used. The main cost driver after the
  -- model itself ($10/1000 searches), so it is worth being able to see it.
  web_searches  integer NOT NULL DEFAULT 0
);

-- The per-user rate-limit query: count this member's rows since a cutoff.
CREATE INDEX bot_questions_user_asked_idx
  ON public.bot_questions (user_id, asked_at DESC);

-- The global daily ceiling, which is not scoped to a user.
CREATE INDEX bot_questions_asked_idx
  ON public.bot_questions (asked_at DESC);

ALTER TABLE public.bot_questions ENABLE ROW LEVEL SECURITY;

-- No policies at all, exactly like pogo_feed_state and pogo_feed_posted_events
-- (023) and message_reports' INSERT path (024). The service-role client in
-- src/lib/supabase/admin.ts is the only writer and the only reader; it bypasses
-- RLS. RLS is still enabled so anon/authenticated get no access BY DEFAULT
-- rather than by omission — a future policy has to be an explicit decision.
--
-- Practical consequence worth knowing: a member cannot read their own rate-limit
-- state. That is intentional. The route tells them when they have hit the limit;
-- exposing the counter would only invite probing it.

-- No realtime publication — nothing client-side listens to this table.
