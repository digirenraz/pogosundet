# Q&A bot — `!pogo` questions in chat

The second half of the 2026-08-16 event-bot brief: the part that *answers*.
Shipped 2026-09-13 (`slice/pogo-qa-bot`). The `#events` poster
([`pogo-event-bot.md`](pogo-event-bot.md)) is the first half and is unchanged by
this — the two share a bot account and nothing else.

## What it does

A member types `!pogo` followed by a question in `#generelt` or `#events`. The
message posts as an ordinary chat message, and a few seconds later the bot
replies in the same channel, quoting the question.

```
Rene      !pogo hvad er en god counter til Mega Gengar?
PoGoBot   ┌ Rene: !pogo hvad er en god counter til Mega Gengar?
          Mega Gengar er Ghost/Poison, så den er svag over for Ghost,
          Dark, Ground og Psychic. …
```

Three things it can draw on:

- **The live ScrapedDuck feed**, via two tools backed by `src/lib/pogo-feed/` —
  the current raid bosses (all tiers, not just the 5-star/mega the poster
  announces) and the upcoming raid events.
- **Web search**, restricted to an allow-list of Pokémon GO sources.
- **The model's own knowledge**, for mechanics that don't change.

Nothing else. No push notification — channel messages deliberately don't push
(see [`../notifications.md`](../notifications.md)), so members get the in-app
badge only, exactly like the event poster.

## Where it runs — a route handler, not an Edge Function

The original brief said "Database Webhook on `channel_messages` INSERT → Edge
Function", matching the five `notify-*` functions. It is a Next.js route handler
instead: `src/app/api/bot/ask/route.ts`, `preferredRegion = 'dub1'`.

The reason is the feed-backed answers. They need `getState()`,
`fetchRaidBosses()` and `formatEventWindow()` — all TypeScript in
`src/lib/pogo-feed/`, which Deno cannot import. An Edge Function would mean
reimplementing the feed cache and the Danish date formatting (including its
documented naive-vs-UTC timestamp trap) a second time in Deno, and wiring a
webhook separately on prod *and* `pogosundet-preview`. The route handler reuses
all of it, and `postAsBot()` unchanged.

One consequence worth knowing: the client triggers the call, so if the tab
closes mid-request the answer is lost. The route defends against everything
that matters — it is handed only a message **id** and re-reads the row
server-side, checking that the session user owns it, that the body really
starts with `!pogo`, that it is less than 60 seconds old, and that the channel
is in `QA_CHANNELS`. A caller cannot make the bot answer a question it did not
post.

## Setup

### 1. Anthropic API key — the project's first metered credential

Everything else in this repo runs on free tiers or OAuth. This does not.

1. Create an account at [console.anthropic.com](https://console.anthropic.com)
   and generate an API key.
2. **Accept the DPA** (Data Processing Addendum) in the Console. This is what
   makes the EU→US transfer lawful, and the Privacy Policy (§7 and §15) states
   that we have one. Do not ship without it.
3. **Set a monthly spend limit.** This is the only cost control that survives a
   bug in the app-level rate limits — see [Cost](#cost) below.

API data is not used for training by default; no action needed for that.

### 2. Vercel env

```
ANTHROPIC_API_KEY=sk-ant-...
```

Set it for **Production and Preview**. Blank disables the feature: the route
answers `503 not_configured` and the composer shows "Botten er ikke slået til
lige nu." This is the same fail-closed posture as `/api/cron/pogo-feed` — an
unset secret means "off", never "open", because this endpoint writes into chat.

`POGO_BOT_USER_ID` is already set from the event bot and is reused as-is. Both
must be present or the route answers `503`.

### 3. Migration 027

`supabase/migrations/027_bot_questions.sql` creates the rate-limit ledger. It is
query-referenced by the route on the first question, so **apply it to prod AND
`pogosundet-preview` before the PR merges**, per the apply-before-merge rule in
CLAUDE.md.

The table deliberately stores **no question text** and **no channel** — only
`user_id`, `asked_at` and token counts. The question already lives in
`channel_messages`; a second copy would be personal data kept for no purpose.
The `channel` column was in the first draft and `/gdpr-check` removed it before
it ever ran: nothing read it (the rate limiter counts by user and time only),
and alongside `user_id` and `asked_at` it described where a named member was
active and when. Same call as the always-null `accuracy_m` column in the
live-locations schema. If you ever want per-channel figures, add the column
*with* the query that reads it, not ahead of one.

`ON DELETE CASCADE` on `auth.users`, and no `profiles` FK, so it can't reproduce
the dual-cascade bug that broke account deletion (migration 025).

## Rate limits

Three layers, weakest to strongest:

| Layer | Limit | Where |
|---|---|---|
| Per user | 5/hour, 20/day | `src/lib/pogo-qa/limits.ts`, counted from `bot_questions` |
| Global | 150/day | same |
| Account | your Console spend limit | Anthropic Console |

Only the last one survives a bug in the first two. Set it.

A rate-limited question still posts to chat as an ordinary message — it just
gets no answer, and only the asker sees the inline notice. The bot never posts
"you are rate limited" into the channel; that would be its own kind of spam.

## Cost

Roughly, per question (~1k input / 200 output at `claude-opus-5`, `effort: low`):

- **without a web search** — about $0.01
- **with a web search** — about $0.06 (search is $10/1000 plus the fetched
  tokens, and is the dominant cost)

At this community's size, expect a couple of dollars a month. The limits above
exist for the pathological case, not the normal one.

## GDPR posture

Covered by **Privacy Policy §15** (and a sentence in §7). The load-bearing
points, because they constrain the implementation:

- **Only the text after `!pogo` is sent.** No trainer name, no user id, no
  friend code, no other messages. Each question is a fresh single-turn request
  with no conversation history, so questions cannot be linked together. The
  system prompt is a frozen constant with no member data interpolated into it.
- **Anthropic is in the USA, not the EU.** There is no EU option — the API's
  `inference_geo` parameter accepts only `us` and `global`. So unlike Supabase,
  Sentry and Amplitude, this processor cannot claim EU residency, and §7 says so
  plainly rather than blurring it. The basis is the DPA + standard contractual
  clauses.
- **A per-device explainer** runs before the first `!pogo`
  (`localStorage['pogosundet:bot-consent']`, the same idiom as the live-location
  share explainer). It names Anthropic, says the question leaves the EU, and
  says plainly not to put personal information in a question. The community
  includes minors, which is why that line is explicit rather than implied.
- **Web search discloses a derived query** to a search provider. §15 says so.

Re-run `/gdpr-check` if you change what is sent.

## Prompt injection and bad answers

The answer posts under the bot's name into a community channel, and
`channel_messages` has **no UPDATE or DELETE policy** — a bad answer cannot be
edited or withdrawn, only hard-deleted by a moderator.

Defences, cheapest first: a tight system prompt (Pokémon GO only, decline
everything else, treat the question as data and never as instructions);
`max_tokens: 1000`; truncation to `CHAT_MESSAGE_MAX_LENGTH`; and plain-text
rendering — the chat renderer linkifies bare URLs and does nothing else, with no
`dangerouslySetInnerHTML` anywhere in the stack.

The residue is covered by existing moderation with no new code: `report_message()`
is polymorphic over `channel_messages`, so a bot answer is reportable by any
member and deletable from `/admin` today.

### ⚠️ Deleting a question does not delete its answer

`channel_messages.reply_to_id` is `ON DELETE SET NULL` (migration 010). So when
a moderator deletes a reported `!pogo` question, the bot's answer **survives** —
it just loses its thread pointer and becomes an orphaned, unthreaded message
that reads as if the bot said it unprompted.

This is pre-existing column semantics, not something this feature chose, but it
is a reasonable thing for a moderator to get wrong: deleting the question looks
like it should take the answer with it. **Delete both**, and check for the
answer immediately below the question before assuming you're done. Worth
revisiting if bot answers ever need moderating in volume — the fix would be a
`reply_to_id`-aware cascade or an admin action that deletes a question together
with any bot reply to it, neither of which is built.

## Troubleshooting

**Nothing happens when I type `!pogo …`.**
Check the channel — it only works in `#generelt` and `#events` (`QA_CHANNELS` in
`src/lib/pogo-qa/types.ts`). `#app-feedback` is deliberately excluded.

**"Botten er ikke slået til lige nu."**
`503 not_configured`: `ANTHROPIC_API_KEY` or `POGO_BOT_USER_ID` is unset on that
deployment. Expected on CI and on any preview without the key.

**"Du har stillet botten en del spørgsmål på kort tid."**
`429`. Either the per-user or the global cap. Check `bot_questions`:

```sql
select user_id, count(*) from public.bot_questions
where asked_at > now() - interval '1 day' group by user_id order by 2 desc;
```

**The answer appears but renders as `—` with a `?` avatar.**
The bot profile isn't reaching author resolution. Same failure mode as the event
poster — see "The bot account is hidden" in
[`pogo-event-bot.md`](pogo-event-bot.md). `getBotProfiles()` must be passed to
`ChannelScreen` as `botProfiles`.

**The typing indicator never appears.**
It needs `botProfiles` to be non-empty (the client reads the bot's id from
there, never from an env var). If the bot account isn't configured, the
indicator is skipped silently by design.

**Answers are slow.**
Expect a few seconds, more when it runs a web search. The typing indicator is
the feedback; there is no streaming — a chat message is posted once, whole.

## Not built

- **A DM-able bot.** The bot is `is_bot`-hidden so it isn't in the DM picker.
  A private Q&A variant needs a "hidden but DM-able" profile *and* would start
  firing `notify-dm` pushes — a different feature with a different privacy
  shape.
- **Conversation memory.** Every question is single-turn. Cheaper, and a much
  simpler privacy story.
- **A regex fast-path** that answers common feed questions without an LLM call.
  The tool-use routing handles these correctly for about a cent; hand-written
  Danish phrase matching is the kind of thing that silently rots.
- **Push notifications for bot answers.** See the `reply_to_id` note in
  [`../notifications.md`](../notifications.md) — answers are threaded, so if the
  planned "reply notifies the author" feature ships, this becomes a decision.
- **Editing or retracting an answer.** No UPDATE policy exists by design;
  moderator delete is the path.
- **Streaming the answer into the channel.** Chat has no partial-message
  rendering, and a half-written bot message is worse than a pause.
