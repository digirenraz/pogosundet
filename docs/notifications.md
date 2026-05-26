# Push notifications — when we send them

Authoritative list of every push / system notification PoGoSundet sends.
**Keep this in sync with the code whenever notification triggers change** (there
is a Claude memory rule enforcing this).

Last reviewed: 2026-05-26.

---

## Currently sent

### 1. New raid posted

| | |
|---|---|
| **Trigger** | Supabase Database Webhook on `INSERT` into `public.raids` → Edge Function `notify-raid` (`supabase/functions/notify-raid/index.ts`). |
| **Recipients** | Every user with a `push_subscriptions` row, **except** the user who posted the raid. |
| **Title** | `Nyt raid!` + ` <boss_name>` when the raid has a boss. |
| **Body** | `<gym_name> — ` (when set) + `Tryk for at se detaljerne`. |
| **Tap action** | Opens `/raids/<raid_id>`. |
| **Delivery** | Self-hosted web-push (VAPID) via the `web-push` library. Subscriptions returning HTTP 410 (Gone) are deleted. |

### 2. New direct message

| | |
|---|---|
| **Trigger** | Supabase Database Webhook on `INSERT` into `public.direct_messages` → Edge Function `notify-dm` (`supabase/functions/notify-dm/index.ts`). |
| **Recipients** | The message recipient only (`push_subscriptions` rows for `recipient_id`). The sender never gets it. |
| **Title** | The sender's `trainer_name` (fallback `Ny besked` if missing). |
| **Body** | Generic `Ny besked` — **no message content** is ever included (GDPR-minimising). |
| **Tap action** | Opens `/chat/dm/<sender_id>` (the conversation with the sender). |
| **Delivery** | Self-hosted web-push (VAPID) via the `web-push` library. Subscriptions returning HTTP 410 (Gone) are deleted. Also drives the home-screen app-icon badge (`type: 'dm'`). |

That is the complete list. No other event sends a notification.

---

## NOT sent (deliberately, as of today)

- Channel chat messages (`#generelt`, `#app-feedback`)
- Replies or reactions (raid chat **or** channel chat)
- Someone joining or leaving a raid you posted/attend
- Account / profile events

These are tracked under the "Define push notification triggers" item — the open
question is which to add without causing notification fatigue.

---

## Platform constraint (iOS)

iOS 16.4+ only delivers web push to PWAs **installed to the Home Screen via
Safari**, with notification permission granted. iOS users who haven't installed
the PWA receive nothing — their fallback is the "Del til Messenger" button on
each raid card.

---

## Planned / proposed (NOT implemented)

- **Channel-message push** — deliberately deferred (notification fatigue).

---

## Target state — message notifications to match other apps

To meet the expectations set by WhatsApp / Messenger / iMessage / Slack, these
are the message notifications we should add, in priority order. All of them must
respect the **cross-cutting behaviours** further down. None are built yet.

### Priority 1 — needed to feel like a messaging app at all
- ~~**New direct message → notify the recipient.**~~ **Shipped** — see "Currently
  sent" entry #2 (`notify-dm`). Content-free payload (sender name only).
- **Reply to your message → notify the author of the replied-to message**
  (channel chat *and* raid chat). We already store `reply_to_id`; a reply is our
  closest analogue to an @mention — high signal, low volume. Should fire even in
  a channel that isn't set to "notify on every message".

### Priority 2 — expected, but tune for noise
- **New message in a raid chat you've joined → notify the other attendees.**
  Coordination is the point of the app. Suppress for the sender and anyone
  currently viewing that raid.
- **Reaction to your message → notify the message author** (DM / channel / raid).
  Messenger and iMessage do this. Lower urgency — good candidate for a per-user
  toggle defaulted *off*, or batched.

### Priority 3 — optional / fatigue-sensitive
- **Every channel message** (`#generelt`, `#app-feedback`) — only worth doing if
  we also add per-channel mute and default busy channels to replies-only.
  Notifying on every channel message by default is the classic fatigue trap;
  prefer the Priority-1 reply notification instead.
- **Someone joins a raid you posted → notify the host.** Useful, low volume.

### Cross-cutting behaviours users expect (apply to all of the above)
- **Suppress when actively viewing** the conversation/channel/raid — don't notify
  for what's already on screen. Best-effort (server can't always know).
- **Grouping / dedupe** — collapse multiple messages from the same sender into one
  notification ("3 nye beskeder fra X") instead of buzzing per message. Use a
  notification `tag` per conversation in the service worker.
- **Mark-as-read sync** — opening a conversation clears its notification and the
  icon badge. We already `markDMRead` on open; the SW should also close the tag
  and update `setAppBadge`/`clearAppBadge`.
- **Mute per conversation / channel** — a way to silence a noisy DM or channel.
  Needs a small `notification_prefs` store (new).
- **Never notify yourself** for your own messages/actions (already the
  `notify-raid` pattern).
- **Quiet hours / Do Not Disturb** (optional, later).

### Privacy tradeoff to decide
Most messaging apps show a **message preview** in the notification. Our current
plan (`docs/plans/app-icon-badge.md`) deliberately sends **no message content**
(sender name only) to avoid exposing text to push services and lock screens — a
GDPR-minimising choice that *diverges* from the typical app. Decide explicitly:
keep content-free (safer, less "normal"), or show previews (more expected),
possibly as a user setting with content-free as the default. Either way, update
Privacy Policy §11.

---

## When you change what we send

In the same change:
1. **Update this document.**
2. Check whether the Privacy Policy push section (§11, `messages/da.json` →
   `Privacy.s11Body`) needs updating, and bump `Privacy.lastUpdated` if so —
   sending notifications for a new event can be new personal-data processing.
3. Update the CLAUDE.md decisions log / "Next up" as appropriate.
