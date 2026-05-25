# Slice 17 — Direct Messages (DMs)

Started: 2026-05-23. **Phase 2 feature being built early at user's explicit request.** CLAUDE.md flags DMs as Phase 2; this slice supersedes that.

Design source: handoff bundle `voYmMyX_oWMRNt-87s1p-w` (`/tmp/pogo-design/dm/chat/`), primary file `Chat.html`. Key components from the design: `DMRow`, `DMScreen`, `DMHeader`, member-row tap-to-DM, online-strip avatar tap-to-DM. Reactions + replies + action sheet are reused unchanged from Slice 13/16 via the shared `MessageStream` shape.

## Scope

**In**
- 1:1 DM between any two profiles in the community.
- `/chat` adds a "Direkte beskeder" section listing the current user's conversations (one row per partner), ordered by latest message.
- New route `/chat/dm/[partnerId]` — the DM screen: header (avatar + trainer name + online/offline), message stream, composer.
- Tap-to-DM from three entry points: (a) `OnlineStrip` avatars on `/chat`, (b) `MembersSheet` rows on a channel screen, (c) `DMRow` on the DM list.
- Per-message reactions + threaded replies — reuses `MessageGroupView` / `Composer` / `MessageActionSheet` (extracted to share with channel/raid chat already).
- Typing indicator (broadcast, no DB write) — same pattern as channels.
- Unread counts: per-conversation badge on `/chat`, plus the BottomNav badge already shows total chat unread (extend to include DM unread).
- Realtime delivery of messages + reactions + typing.

**Out (deliberate)**
- Group DMs — 1:1 only.
- Image / file attachments in the composer (the `+` button in the design is decorative — channel chat has the same).
- Push notifications for new DMs — the broader "Define push notification triggers" TODO will decide this. Slice 17 leaves the existing notify-raid Edge Function alone.
- Composer "pencil / new DM" button on the chat home header — the OnlineStrip and MembersSheet are sufficient entry points; the design's pencil button stays out of MVP.
- Block / mute / delete-conversation actions — Phase 2+.
- Cross-message search.

## Data model — migration `014_direct_messages.sql`

```sql
-- Direct messages between two profiles.
CREATE TABLE public.direct_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(trim(body)) > 0),
  reply_to_id uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);

CREATE INDEX direct_messages_pair_idx
  ON public.direct_messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at DESC);

CREATE INDEX direct_messages_reply_to_idx
  ON public.direct_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read own DMs" ON public.direct_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send DMs as themselves" ON public.direct_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- FK to profiles so embedded selects (sender:profiles(trainer_name,...)) work.
ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_sender_profile_fk
  FOREIGN KEY (sender_id) REFERENCES public.profiles(user_id);
ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_recipient_profile_fk
  FOREIGN KEY (recipient_id) REFERENCES public.profiles(user_id);

-- Reactions — same shape as channel/raid reactions.
CREATE TABLE public.direct_message_reactions (
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE public.direct_message_reactions ENABLE ROW LEVEL SECURITY;

-- Only conversation participants can read reactions on a DM.
CREATE POLICY "Participants can read DM reactions" ON public.direct_message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.direct_messages m
      WHERE m.id = message_id
        AND (auth.uid() = m.sender_id OR auth.uid() = m.recipient_id)
    )
  );

-- Only participants can add reactions, and only as themselves.
CREATE POLICY "Participants can add DM reactions" ON public.direct_message_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.direct_messages m
      WHERE m.id = message_id
        AND (auth.uid() = m.sender_id OR auth.uid() = m.recipient_id)
    )
  );

CREATE POLICY "Users remove own DM reactions" ON public.direct_message_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Read tracking — one row per (user, partner) pair.
CREATE TABLE public.dm_reads (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, partner_id),
  CHECK (user_id <> partner_id)
);

ALTER TABLE public.dm_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own dm_reads" ON public.dm_reads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own dm_reads" ON public.dm_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own dm_reads" ON public.dm_reads
  FOR UPDATE USING (auth.uid() = user_id);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_message_reactions;
```

Apply manually in the Supabase SQL editor before merging.

## Routes / pages

- `src/app/[locale]/chat/page.tsx` — extend SSR to fetch the current user's DM conversations + per-conversation unread counts.
- `src/app/[locale]/chat/dm/[partnerId]/page.tsx` (new) — SSR fetch of one conversation's messages + reactions + the partner profile, then mark-as-read via UPSERT, then render `DMScreen`. Mirrors `chat/[channelId]/page.tsx`.
- Server pages MUST export `preferredRegion = "dub1"` (CLAUDE.md).
- 404 the DM page if `partnerId` is the current user.

## Code changes

### 1. New: `src/lib/dm/`
- `helpers.ts` — client helpers: `sendDM(senderId, recipientId, body, replyToId?)`, `toggleDMReaction(messageId, userId, emoji)` (try-INSERT-then-DELETE pattern).
- `server-helpers.ts` — `getDMConversations(userId)` returning `{ partner_id, last_message, unread_count, typing }[]` ordered by `last_message.created_at DESC`. `getDMConversation(userId, partnerId)` returning `{ partner: Profile, messages: DMWithReactions[] }`. `markDMRead(userId, partnerId)` (UPSERT on `dm_reads`).
- `read-helpers.ts` — `getUnreadDMTotal(userId)` for the BottomNav badge integration.
- `reactions-helpers.ts` (+ test) — duplicate of the raid/chat reactions pattern but on `direct_message_reactions`.
- `use-dm-realtime.ts` — subscribes to INSERTs on `direct_messages` filtered by `recipient_id=eq.{userId}` AND the open partner. Topic: `dm:${pairKey}:${Math.random()...}`.
- `use-dm-reactions-realtime.ts` — INSERT/DELETE on `direct_message_reactions`, filtered client-side by `messageIdSet`.
- `use-dm-list-realtime.ts` — listens for INSERTs on any DM where current user is recipient OR sender, updates the list ordering + unread counts. Used on `/chat`.
- `use-dm-unread.ts` — exposes the running total for the BottomNav badge; subscribes to INSERTs on incoming DMs.
- `pair-key.ts` — small pure util `pairKey(a, b) = [a, b].sort().join(':')`. Used as deterministic realtime topic key.

### 2. New components in `src/components/chat/`
- `DMRow.tsx` — channel-list-row analogue for DMs (avatar + name + last-message preview + relative time + unread badge + typing indicator).
- `DMScreen.tsx` — root for `/chat/dm/[partnerId]`. Mirrors `ChannelScreen.tsx` but feeds `MessageGroupView` from DM data. Intro card shows partner avatar + "Direkte besked · kun jer to kan se den".
- `DMHeader.tsx` — back arrow + avatar + name + online/offline. Replaces channel header on the DM route.

### 3. Modified components
- `ChannelListScreen.tsx` — add the "Direkte beskeder" section below the channels section. Empty state: subtle helper text "Tryk på en træner i Online nu for at starte en ny samtale."
- `OnlineStrip.tsx` — accept an `onAvatarTap(partnerId)` callback so the channel-list view can route to a DM.
- `MembersSheet.tsx` — make rows tappable (chat icon trailing); call `onOpenDM(partnerProfile)`. Closing the sheet first, then routing.
- `BottomNav` — extend the existing unread badge to include `getUnreadDMTotal(currentUserId)`. (Already a single-source-of-truth badge via the chat icon — just expand the sum.)

### 4. Routing helpers
- A new helper or inline `router.push(\`/chat/dm/${partnerId}\`)` in the three entry points. Use the next-intl `Link` if available; otherwise vanilla.

### 5. Translation strings (`messages/da.json`)
- `Chat.dmSectionTitle` = "Direkte beskeder"
- `Chat.dmSectionEmpty` = "Ingen samtaler endnu"
- `Chat.dmSectionHint` = "Tryk på en træner i Online nu for at starte en ny samtale."
- `Chat.dmIntroLine` = "Direkte besked · kun jer to kan se den"
- `Chat.dmCount` / `Chat.dmUnread` = "{n} samtaler" / "{n} ulæste"
- `Chat.dmOnline` / `Chat.dmOffline` = "Online nu" / "Offline" (already present?)
- `Chat.dmYou` = "Du"
- Reuse existing reaction/reply strings (`Chat.replyingTo`, `Chat.replyPlaceholder`, `Chat.cancelReply`, `Chat.actionCopied`, `Chat.closeSheet`).

### 6. `src/lib/chat/types.ts`
- Extend or add a `DMMessage` type that mirrors `ChatMessage` (shared shape: `id`, `author_id`, `body`, `sent_at`, `reply_to_id`, `reactions`, `profiles`). The existing `ChatMessage` is generic enough to reuse directly — no new shape needed if we wire DMs to it.

### 7. `src/proxy.ts` / auth guard
- DM pages are auth-required. The centralised profile-existence guard in `src/lib/supabase/middleware.ts` already protects everything except a static skiplist; `/chat/dm/...` automatically gets it. No middleware change needed.

### 8. `public/sw.js`
- Bump `SHELL_CACHE` and `RUNTIME_CACHE` from v8 → v9.

### 9. CLAUDE.md
- Open question / Decisions log entry dated 2026-05-23: "Slice 17 — DMs (built early at user request despite Phase 2 designation)…".
- Remove "DMs deferred to Phase 2" line in the architecture's Phase plan; add a new "Shipped" entry.
- Migrations list bumps to include `014_direct_messages`.

## Tests

- `src/lib/dm/reactions-helpers.test.ts` — mirror raid/chat tests.
- Optional: a unit test for `pairKey()` and `getUnreadDMTotal()`.
- `e2e/dm.spec.ts` — single-user happy path: open Members sheet, tap a member, send a message, react, reply, back to `/chat` and confirm the DM appears in the list with the right preview. Cross-user verification is on the Vercel preview (per the 2026-05-19 unreliable-realtime rule).

## Realtime caveats

- **All cross-user testing on the Vercel preview.** Local Realtime is unreliable, especially with HMR.
- Topic name MUST suffix with `Math.random()` per the 2026-05-19 collision rule.
- Mark-as-read happens server-side on DM page render (UPSERT `DO UPDATE`); the DM list page seeds rows with `NOW()` via `DO NOTHING` so a first-time visitor doesn't see "everything unread".

## Privacy / GDPR

DMs are personal data — verify before merging:
- [ ] Privacy Policy (`messages/da.json` → `Privacy`) updated to disclose DM storage + retention. Bump `Privacy.lastUpdated`.
- [ ] Account deletion cascade verified: `direct_messages` rows where the deleting user is sender or recipient must be deleted (auth.users delete cascades via the FK).
- [ ] `dm_reads` rows likewise cascade.
- [ ] `direct_message_reactions` cascade via the message FK.
- [ ] RLS confirmed: try selecting a third user's DM via SQL editor as that third user — must return 0 rows.

## PR / deploy

- Branch: `slice/17-direct-messages` off `main`.
- Apply migration in Supabase SQL editor before merging.
- After merge: SW v8 → v9 forces fresh JS / HTML.

## Scope / cost note

This is the largest feature since Slice 11 (community chat). Conservatively: 1 migration, ~12 new source files (lib + components + tests + e2e + DM page route), ~6 modified files, 1 Privacy Policy bump, 1 SW bump, CLAUDE.md updates. Realistic line count: 1500–2000 lines across all the touched files.
