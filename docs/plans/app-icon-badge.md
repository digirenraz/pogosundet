# Plan: App-icon unread badge (closed-app, push-driven)

Status: planned — implement on a later date (user's call).

## Context

The PWA shows an in-app unread count on the **Chat** tab (`BottomNav`), but the
installed home-screen icon has no badge. The goal is a native-messaging-style
numeric badge on the home-screen icon reflecting unread chat (channels + DMs),
updating **even when the app is closed** — the genuinely useful case.

This is feasible via the web **Badging API** (`navigator.setAppBadge(n)` /
`clearAppBadge()`), available on iOS 16.4+ installed PWAs (same notification gate
as our existing push), desktop Chrome/Edge, and Android (often shown as a dot).

**The closed-app requirement has a hard dependency:** the badge can only change
while the app is closed from inside the service-worker `push` handler — but today
push only fires for new raids (`notify-raid`); DMs/messages never push. So this
plan also builds **DM push notifications** (the long-standing "Define push
notification triggers" TODO, scoped to DMs).

Decided scope: full closed-app badge. Badge = total unread chat (channels + DMs),
mirroring `BottomNav`'s `unreadTotal`. Raids are transient notifications, not
"unread", so they do **not** affect the badge.

## How the pieces fit

```
DM inserted ──webhook──> notify-dm Edge Fn ──web-push──> SW 'push' handler
                                                          │ type==='dm'
                                                          ▼
                                            IndexedDB badgeCount++ ; setAppBadge()
App open: UnreadProvider (layout) computes true total ──> setAppBadge(total)
          and writes total back to IndexedDB so SW increments from truth.
Read msgs / open convo: total drops ──> setAppBadge/clearAppBadge + rewrite IDB.
```

The client owns the *accurate* count (recomputed from the DB on open); the SW
owns *increments while closed*. They share one number via IndexedDB, so reopening
the app reconciles any drift.

## Work items

### 1. Shared unread source — `src/components/UnreadProvider.tsx` (new), mounted in `src/app/[locale]/layout.tsx`
- Client provider that fetches `userId` (`getClaims`, as `BottomNav` does today),
  runs `useChannelUnread` + `useDMUnread` **once**, and exposes
  `{ total, clearChannel, clearPartner }` via context.
- `BottomNav` (`src/components/BottomNav.tsx`) consumes the context instead of
  calling the hooks itself.
- **Bonus:** because the `[locale]` layout persists across navigation, the hooks
  no longer remount/refetch per page — this **closes the existing "BottomNav
  badge flicker" TODO** in CLAUDE.md.
- Guards null `userId` (logged-out pages share this layout) — the hooks already
  no-op when `userId` is null.

### 2. Badge helper + shared count store — `src/lib/push/app-badge.ts` (new)
- `setBadge(n)` / `clearBadge()`: feature-detect `navigator.setAppBadge`
  (no-throw when unsupported), clamp negatives to 0, `clear` when 0.
- Minimal promisified **IndexedDB** wrapper (one DB `pogosundet`, store `meta`,
  key `badgeCount`) with `readBadgeCount()` / `writeBadgeCount(n)` — usable from
  the client. The SW inlines the equivalent (classic SW can't import ES modules).
- `UnreadProvider` effect: on `total` change, on mount, and on `visibilitychange`/
  `focus` (resume from background) → `setBadge(total)` and `writeBadgeCount(total)`.

### 3. Service worker — `public/sw.js` (modify) + bump `v9 → v10`
- Add an inline IndexedDB read/write for `badgeCount`.
- In the `push` handler: parse `data.type`. If `type === 'dm'` (message types),
  `count = (await readBadgeCount()) + 1; writeBadgeCount(count); navigator.setAppBadge(count)`
  **inside** `event.waitUntil(...)`, alongside the existing `showNotification`.
  For `type === 'raid'` (or missing), behave exactly as today (no badge change).
- Optionally clear/refresh badge in `notificationclick` (app reconciles on open
  anyway — low priority).

### 4. Payload contract + `notify-raid` tweak
- Add a `type` field to all push payloads. `notify-raid`
  (`supabase/functions/notify-raid/index.ts`) adds `type: 'raid'`.
- SW only mutates the badge for message types — keeps raids out of the count.

### 5. DM push — `supabase/functions/notify-dm/index.ts` (new) + DB webhook
- Mirror `notify-raid` structure (web-push, VAPID secrets, 410 cleanup).
- Trigger: Supabase **Database Webhook on `public.direct_messages` INSERT**
  (documented in the file header like `notify-raid`; configured in the dashboard).
- Target: the single recipient — `push_subscriptions` `.eq('user_id', record.recipient_id)`.
- Title = sender's `trainer_name` (join `profiles`). **Body = generic** (e.g.
  "Ny besked") with **no message content** — GDPR-minimising; avoids leaking text
  to push services / lock screens. `url: '/chat/dm/<sender_id>'`, `type: 'dm'`.
- Deploy: `npx supabase functions deploy notify-dm`.

### 6. Privacy Policy — `src/app/[locale]/privacy/page.tsx` content in `messages/da.json` (§11 Push)
- Extend §11 to note DM notifications may be sent (sender name only, no message
  content). Bump `Privacy.lastUpdated`. New processing → required per CLAUDE.md.

### 7. CLAUDE.md
- Decisions log entry; remove the "BottomNav badge flicker" TODO (resolved by #1)
  and fold the DM-push half of "Define push notification triggers" into shipped.

## Deliberate exclusions (scoping)
- **Channel-message push is deferred** (high notification-fatigue risk per
  CLAUDE.md). Consequence: channel unread that arrives while the app is *closed*
  won't bump the icon badge until next app open (when the client reconciles to
  the true total). DM closed-app badging is fully covered. Documented as accepted.
- **No message content in push payloads** (privacy) — title is sender name only.
- No "suppress notification while actively viewing that conversation" — not
  reliably knowable server-side; accepted (same as raids today). Badge stays
  correct via reconciliation.
- No DB/migration changes (all tables exist: `push_subscriptions`, `dm_reads`).

## Reused building blocks
- `src/lib/push/subscription-helpers.ts` — existing subscribe/VAPID flow; no change.
- `useChannelUnread` / `useDMUnread` — the real-count source, moved up into the provider.
- `notify-raid/index.ts` — template for `notify-dm` (web-push, secrets, 410 cleanup).
- `markDMRead` (`src/lib/dm/server-helpers.ts`) — already zeroes a conversation's
  unread on open, which the provider's recompute will reflect into the badge.

## Verification
- **Unit (vitest):** `app-badge.ts` — feature-detect no-throw when
  `navigator.setAppBadge` absent; clamp; IndexedDB roundtrip via `fake-indexeddb`.
- **Cannot be tested in `npm run dev`** — needs an installed PWA + real push.
  Verify on a real device (installed via Safari, notifications granted):
  1. *Foreground:* app open, partner sends DM → in-app badge **and** icon badge
     increment; open the conversation → both clear.
  2. *Closed-app:* fully close the PWA, partner sends DM → push arrives and the
     **icon badge increments while closed**; reopen → badge reconciles to the
     true unread total.
  3. *Raid push* still arrives with **no** badge change.
- Desktop Chrome installed PWA for faster iteration before device testing.

## Risks / open questions
- iOS SW `navigator.setAppBadge` behaviour should be confirmed on a real device
  early (spec-supported on 16.4+, but verify before building the rest).
- IndexedDB access from the SW push handler must complete inside `waitUntil`
  before the SW is killed — keep it minimal.
- `UnreadProvider` lifting hooks up is a real refactor of `BottomNav`; validate
  the in-app badge still behaves after the move (and that the flicker is gone).
