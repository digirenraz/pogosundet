# Chat replies + emoji reactions

Design: Claude Design handoff `Ux3Oda-pZaILRv_Gb-hPqw`, primary file `Chat.html`.
Started: 2026-05-22.

## Scope

**In** — channel chat only (`#generelt`, `#app-feedback`):
- Tap-to-act bottom sheet on any bubble (quick reaction row + Svar + Kopiér tekst)
- Emoji reactions rendered as chips below bubbles, user's own highlighted teal, tap to toggle
- Threaded replies: quoted preview above the reply bubble, reply-preview banner in the composer with × to cancel

**Out (deliberate)**
- DMs — Phase 2 per CLAUDE.md.
- Reactions/replies on raid chat (`raid_messages`) — separate task; design bundle is channel-only.
- "Gem" / "Anmeld" actions — user dropped these in the design chat.
- Long-press / haptics — tap-to-open matches the prototype.

## Data model — migration `010_chat_reactions_and_replies.sql`

```sql
ALTER TABLE channel_messages
  ADD COLUMN reply_to_id uuid REFERENCES channel_messages(id) ON DELETE SET NULL;
CREATE INDEX channel_messages_reply_to_idx
  ON channel_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

CREATE TABLE channel_message_reactions (
  message_id uuid NOT NULL REFERENCES channel_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
ALTER TABLE channel_message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reactions"  ON channel_message_reactions FOR SELECT USING (true);
CREATE POLICY "Users add own reactions"    ON channel_message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own reactions" ON channel_message_reactions FOR DELETE USING  (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE channel_message_reactions;
```

PK enforces "one of each emoji per user per message" — toggle = INSERT or DELETE.

## Files

**New components**
- `src/components/chat/Reactions.tsx` — emoji chip row, own reaction teal, trailing `+` button.
- `src/components/chat/ReplyQuote.tsx` — quoted preview above a reply bubble; accent bar flips on `mine`.
- `src/components/chat/MessageActionSheet.tsx` — bottom sheet with quick-reaction row + Svar + Kopiér tekst.

**Edited components**
- `MessageGroup.tsx` — accept `messagesById`, `onTap`, `onReactToggle`, `highlightedId`; render `<ReplyQuote>` above bubbles whose `reply_to_id` resolves, `<Reactions>` below bubbles with reactions, dim other bubbles when the sheet is open. Bubble that has reactions or follows a reply counts as a corner-rounding "break".
- `Composer.tsx` — optional `replyTo`/`onCancelReply` props; render preview banner above the textarea, swap placeholder to `Skriv et svar til {trainerName}`, include `reply_to_id` on send.
- `ChannelScreen.tsx` — own `replyTo`, `actionMsgId`, and `reactionOverrides` state (sparse `messageId → ReactionsMap` overlay merged onto initial messages). Build `messagesById` index. Wire new reactions-realtime hook.

**New helpers + realtime**
- `src/lib/chat/reactions-helpers.ts` — `toggleReaction(messageId, userId, emoji)` (try INSERT, fall back to DELETE on PK conflict); pure `groupReactions(rows)` → `{ emoji: userId[] }`.
- `src/lib/chat/helpers.ts` — `sendMessage` gains optional `replyToId`; export `ChannelReactionRow`.
- `src/lib/chat/server-helpers.ts` — `getMessagesForChannel` selects `reactions:channel_message_reactions(emoji, user_id)` and `reply_to_id`; `ChannelMessage` shape gains both.
- `src/lib/chat/use-channel-reactions-realtime.ts` — subscribe to INSERT/DELETE on `channel_message_reactions`. Per-mount topic name with `Math.random()` suffix to avoid the 2026-05-19 Supabase channel-name collision.

## Strings (`messages/da.json` → `Chat`)
- `actionSvar` = "Svar"
- `actionKopier` = "Kopiér tekst"
- `actionCopied` = "Kopieret"
- `replyingTo` = "Svarer {name}"
- `replyPlaceholder` = "Skriv et svar til {name}"
- `cancelReply` = "Annullér svar"
- `closeSheet` = "Luk"

## Tests
- `src/lib/chat/reactions-helpers.test.ts` — `groupReactions` shape; toggle picks correct DB op.
- `e2e/chat-reactions-replies.spec.ts` — tap a message, tap 👍 from the sheet, assert chip; tap chip again to remove; tap message → Svar → send → quoted preview above the reply bubble.

## Verification
- Vitest, `npx tsc --noEmit`, `npm run lint`.
- Playwright MCP for a manual run.
- Two-account check on the Vercel preview (per 2026-05-19 "Realtime: verify in prod, not dev").

## Migration step
No runner — produce `supabase/migrations/010_chat_reactions_and_replies.sql`, paste into Supabase SQL editor.
