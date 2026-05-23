# Raid chat — replies + emoji reactions

Started: 2026-05-23. Mirrors Slice 13 (channel chat) onto raid chat. The TODO in `CLAUDE.md` → "Next up" → "Replies on raid chat" calls explicitly for this pattern parity.

Reference implementation: see `docs/plans/chat-reactions-replies.md` and migration `010_chat_reactions_and_replies.sql`. Key files to mirror: `src/lib/chat/reactions-helpers.ts`, `use-channel-reactions-realtime.ts`, `src/components/chat/{MessageGroup,Reactions,ReplyQuote,MessageActionSheet,Composer}.tsx`, `ChannelScreen.tsx`.

## Scope

**In**
- Tap-any-bubble action sheet on raid chat (6 quick-reaction emojis + Svar + Kopiér tekst), same set as channel chat.
- Reactions rendered as tappable chips under raid chat bubbles. Toggle = INSERT (try) → fall back to DELETE on PK conflict.
- Threaded replies inside a raid: quoted preview above the reply bubble, reply-preview banner above the input with × to cancel.
- Upgrade the raid chat UI to use the same `MessageGroupView` / `Composer` / `MessageActionSheet` stack as channel chat (current raid chat is a stripped-down inline list — that hand-rolled list is replaced).

**Out (deliberate)**
- DMs — Phase 2.
- Cross-raid reactions/notifications (e.g. push when someone reacts to your raid message) — separate decision in the "Define push notification triggers" TODO.
- Renaming `raid_messages.message` → `body` for parity with `channel_messages.body` — the column name stays; we adapt the shared types instead.

## Data model — migration `013_raid_chat_reactions_and_replies.sql`

Mirror of 010 but on `raid_messages`:

```sql
ALTER TABLE public.raid_messages
  ADD COLUMN reply_to_id uuid REFERENCES public.raid_messages(id) ON DELETE SET NULL;

CREATE INDEX raid_messages_reply_to_idx
  ON public.raid_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

CREATE TABLE public.raid_message_reactions (
  message_id uuid NOT NULL REFERENCES public.raid_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE public.raid_message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read raid reactions"  ON public.raid_message_reactions FOR SELECT USING (true);
CREATE POLICY "Users add own raid reactions"    ON public.raid_message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own raid reactions" ON public.raid_message_reactions FOR DELETE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.raid_message_reactions;
```

Paste into the Supabase SQL editor; CLAUDE.md migrations list bumps to `013_raid_chat_reactions_and_replies`.

## Code changes

### 1. `src/lib/raids/message-helpers.ts`
- Extend `RaidMessage`:
  - Add `reply_to_id: string | null`.
  - Replace the narrow `profiles: { trainer_name: string } | null` with the richer shape used by `MessageGroupView`: `{ trainer_name, avatar_url, team, level }`.
  - Add `reactions: { user_id: string; emoji: string }[]` (raw from the embed; client groups it).
- `RaidMessageRow` adds `reply_to_id: string | null`.
- `sendMessage(raidId, userId, message, replyToId?: string)` — insert `reply_to_id` when present.
- `getMessagesForRaid` query:
  ```ts
  .select(`*, profiles(trainer_name, avatar_url, team, level), raid_message_reactions(user_id, emoji)`)
  ```
- Aliasing note: PostgREST returns the embed under the table name `raid_message_reactions`; map it to a `reactions` field client-side (or use the PostgREST `reactions:raid_message_reactions(...)` alias for cleanliness).

### 2. `src/lib/raids/server-helpers.ts`
- `getRaidById` and any other call that hydrates raid + messages: select the same enriched profile fields + the reactions embed so SSR's initial state matches the client shape.
- Update `RaidWithDetails` type accordingly.

### 3. `src/lib/raids/reactions-helpers.ts` (new)
- Duplicate `src/lib/chat/reactions-helpers.ts` but target `raid_message_reactions`. The shape (`message_id`, `user_id`, `emoji`) is identical; `groupReactions` is structurally pure and could be re-exported from chat — but duplicate to keep raid helpers self-contained.
- Export `toggleReaction(messageId, userId, emoji)`, `groupReactions(rows)`, `RaidReactionRow` type.
- Co-locate `reactions-helpers.test.ts` mirroring chat's tests.

### 4. `src/lib/raids/use-raid-reactions-realtime.ts` (new)
- Mirror of `src/lib/chat/use-channel-reactions-realtime.ts`. Signature:
  ```ts
  useRaidReactionsRealtime(raidId: string, currentUserId: string | null, messageIdSet: Set<string>, callbacks: ReactionCallbacks)
  ```
- Subscribes to INSERT/DELETE on `public.raid_message_reactions`, filters client-side by the live `messageIdSet` ref.
- Topic: `raid:reactions:${raidId}:${Math.random().toString(36).slice(2)}` to dodge the collision documented 2026-05-19.

### 5. `src/lib/raids/use-raids-realtime.ts`
- Already exists. Confirm it still emits raw `RaidMessageRow` INSERTs; if so leave it alone. Reactions live in their own hook (above).

### 6. `src/components/RaidDetail.tsx`
- Refactor the chat section to use `MessageGroupView`, `MessageActionSheet`, `Composer` from `src/components/chat/`. Hoist the orchestration that lives in `ChannelScreen.tsx`:
  - `messages` state typed as `ChatMessage[]` (the shape exported from `ChannelScreen.tsx`). Either import it as-is or move it to `src/lib/chat/types.ts` for cleaner sharing.
  - `messagesById` memo, `groupMessages(messages, ...)` for grouping.
  - `replyTo`, `actionMsgId`, `reactionOverrides` state.
  - `handleReactToggle(messageId, emoji)` — optimistic override + `toggleReaction` from the raid-side helper.
  - Realtime: keep the existing `useRaidsRealtime` for message INSERTs (raid chat stays local-state-driven, not router.refresh); add `useRaidReactionsRealtime` parallel to it.
  - `handleSend` accepts the current `replyTo?.id` and clears `replyTo` after send.
- The current attendee strip, RSVP, hero image stay untouched — only the message list + input strip change.
- The pinned input gets replaced by the channel-chat `Composer`, which already renders the reply banner.

### 7. Shared type extraction (optional but clean)
- Move `ChatMessage` from `src/components/chat/ChannelScreen.tsx` to `src/lib/chat/types.ts` (or `src/components/chat/types.ts`) and re-export. Raid chat imports the same type to feed `MessageGroupView`. This avoids a circular import (`RaidDetail` → `ChannelScreen`).

### 8. Translation strings — `messages/da.json`
- Existing channel-chat strings (`Chat.replyingTo`, `Chat.replyPlaceholder`, `Chat.cancelReply`, `Chat.actionCopied`, `Chat.closeSheet`, `Chat.replyAction`, `Chat.copyAction`) are already generic — reuse them via `useTranslations('Chat')` inside the raid chat block. No new keys needed unless the action sheet wording diverges.

### 9. CLAUDE.md
- Remove the "Replies on raid chat" item from "Next up".
- Add a Decisions log entry: "Slice 16: raid chat reactions + replies. Migration 013 …".
- Bump migrations list to include `013_raid_chat_reactions_and_replies`.

## Tests

- `src/lib/raids/reactions-helpers.test.ts` — mirror channel's tests for `toggleReaction` (mock the supabase client) and `groupReactions`.
- Existing `message-helpers` tests — update fixtures to include `reply_to_id` and an empty reactions array.
- Add an `e2e/raid-chat-reactions.spec.ts` that: opens a raid → taps a message → picks 👍 → asserts chip appears → taps again → asserts removal. Reply: tap → Svar → composer shows banner → send → quote renders above the new bubble. Keep it scoped to one user (cross-user realtime is unreliable locally — 2026-05-19 decision).

## Realtime correctness checks

- New SW JS will not propagate to installed PWAs unless `public/sw.js` cache version is bumped. Bump `SHELL_CACHE` / `RUNTIME_CACHE` (v7 → v8) in the same PR.
- Verify cross-user reaction delivery on the Vercel preview, not locally (per the 2026-05-19 decision).
- Topic name MUST suffix with `Math.random()` — duplicate-mount collision protection.

## PR / deploy

- Branch: `slice/16-raid-chat-replies-reactions` off `main`.
- Apply migration in Supabase SQL editor before merging (manual step per CLAUDE.md).
- After merge: bump SW version on first follow-up commit if not done in this PR, deploy, scan on a real installed PWA.
