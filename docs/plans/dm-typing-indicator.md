# DM typing indicator — fix + chat-list parity

Branch: `fix/dm-typing-indicator`

## Problem

Channel chat shows "X skriver…" both inside a channel and on the `/chat` list rows.
DMs were coded to do the same but it doesn't work:

1. **In-conversation (broken).** `DMScreen` renders the indicator and `Composer`
   fires `broadcastTyping`, but `useDMRealtime` subscribes to a topic with a
   `Math.random()` suffix: `dm:${pairKey}:${random}`. Typing uses Supabase
   **broadcast**, which only reaches clients on the *exact same topic string*.
   With a random suffix the two participants are on different topics, so typing
   pings never cross. (Message INSERTs work anyway — postgres_changes is
   replication-based, not topic-matched. That's why messaging works but typing
   doesn't.) Channel chat uses a stable `chat:${id}` topic, so its typing works.

2. **Chat-list (missing).** `ChannelListScreen` passes `typing={false}` to every
   `DMRow` (DMRow already supports the prop). Channel rows get typing via
   `useChannelListTyping`; DMs have no equivalent hook.

## Fix

### 1. Shared topic helper — `src/lib/dm/pair-key.ts`
Add `dmTypingTopic(a, b)` → `` `dm-typing:${pairKey(a, b)}` ``. Stable + symmetric,
so both participants and the list hook all derive the identical topic.

### 2. In-conversation — `src/lib/dm/use-dm-realtime.ts`
Split the typing broadcast onto its own **stable, broadcast-only** channel
(`dmTypingTopic`), separate from the message channel. The message channel keeps
its random-suffixed topic + postgres_changes exactly as-is (no risk to the
working message path; broadcast-only channel can't trigger the postgres_changes
collision rule). `broadcastTyping` sends on the typing channel; the typing
listener lives on the typing channel.

### 3. Chat-list hook — `src/lib/dm/use-dm-list-typing.ts` (NEW)
Mirror `useChannelListTyping` but keyed by partner. Given `currentUserId` and
`partnerIds[]`, subscribe to `dmTypingTopic(me, partnerId)` per partner; return a
`Set<string>` of partnerIds currently typing (3s idle expiry, same as the others).
Effect depends on a **stable sorted key** of partnerIds (not array identity) to
avoid re-subscribe churn as the DM list re-sorts on new messages.

### 4. Wire the list — `src/components/chat/ChannelListScreen.tsx`
Call `useDMListTyping(currentUserId, partnerIds)`; pass
`typing={typingPartners.has(entry.partnerId)}` to `DMRow` instead of `false`.

## Tests / verification
- Unit: extend `pair-key.test.ts` — `dmTypingTopic` is symmetric.
- `npm run build` (type gate) + `npm run test`.
- **Cross-user typing is realtime broadcast** — per the 2026-05-19 decision it
  can't be verified reliably in `npm run dev`. Verify on the Vercel preview
  (two accounts): typing shows in the thread and on the other user's `/chat` row.
  No single-user Playwright assertion is meaningful for cross-user propagation.

## Out of scope
No DB/migration/SW changes. No push notifications for typing.
