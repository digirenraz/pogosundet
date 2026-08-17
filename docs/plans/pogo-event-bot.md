# Event bot — #events channel

Automated raid-event and raid-boss-rotation posts, sourced from the ScrapedDuck
feed. Shipped 2026-08-16 (`slice/pogo-event-bot`).

## What it does

Every 20 minutes a GitHub Actions workflow POSTs `/api/cron/pogo-feed`. The route
fetches two ScrapedDuck endpoints, works out what changed since last time, and
posts the diff to `#events` as a hidden bot account.

- **New raid events** → one message each: name, time window, LeekDuck link.
- **Raid boss rotation changed** → one message listing the current line-up by
  tier, shiny-eligible bosses marked ✨.

Nothing else. No push notification (channel messages deliberately don't push —
see `docs/notifications.md`), so members get an in-app badge only.

## Data source

[ScrapedDuck](https://github.com/bigfoott/ScrapedDuck) scrapes LeekDuck.com with
permission and republishes JSON. **We never scrape LeekDuck directly.**

The data lives on a separate `data` **branch**, not under `data/` on the default
branch — the obvious-looking `.../main/data/events.json` 404s:

- `https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json`
- `https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/raids.json`

**Licence terms** (from their README): no paywall, no ads, and credit both
ScrapedDuck and LeekDuck. We satisfy the credit requirement in the `#events`
channel description and in the footer of every rotation post. Don't remove
either.

**Polling budget.** ScrapedDuck re-scrapes every 10 minutes;
`raw.githubusercontent.com` caches for 5 minutes and serves an ETag; GitHub
allows 5000 requests/hour per IP. We poll two files every 20 minutes with
`If-None-Match`, so most polls return an empty `304`. There is nothing to gain
from polling faster than 5 minutes.

### Two traps in the feed

1. **`raids.json` has no ID field.** Identity is `(tier, name)`, so the rotation
   is diffed by fingerprint. Tier labels have already drifted once — the wiki
   documents `"Tier 3"`, live data returns `"3-Star Raids"` — so tier strings are
   treated as opaque labels, sorted via a lookup with an unknown-sorts-last
   fallback. Never parse them for meaning.

2. **`start` / `end` mix two meanings.** No suffix = local wall-clock (Raid Hour
   is 18:00 for everyone); a `Z` suffix = one global instant. Handing a naive
   string to `new Date()` parses it as server-local, which on Vercel is UTC — so
   a Danish summer event would render two hours early. `parseFeedTimestamp` in
   `format.ts` handles both; there are tests pinning each.

## Setup (once per Supabase project — prod AND preview)

1. **Apply migration 023** (`supabase/migrations/023_events_channel_and_feed_state.sql`)
   in the SQL editor.

2. **Create the bot auth user**: Supabase dashboard → Authentication → Add user.
   A random password, auto-confirm. Nothing ever logs in as it — the poster uses
   the service-role client — so the password is throwaway.

   For the email, use a plus-tag on an address you actually control, e.g.
   `<your-address>+pogobot@…`. Gmail-style plus-tags deliver to the same inbox
   but are unique, which satisfies Supabase's uniqueness constraint. Avoid
   inventing an address at a domain nobody owns: mail to it bounces into the
   void, and if a password reset or confirmation is ever triggered it goes
   nowhere. Use a different tag on prod and preview so the two bot users are
   distinguishable.

3. **Create the bot profile.** `friend_code` must satisfy the format CHECK from
   migration 011, hence the zeros:

   ```sql
   insert into public.profiles (user_id, trainer_name, friend_code, is_bot, bio)
   values (
     '<the auth user UUID from step 2>',
     'PoGoSundet',
     '0000 0000 0000',
     true,
     'Automatiske opdateringer om raids og events. Data fra LeekDuck.com.'
   );
   ```

4. **Vercel env vars.** Both are a single variable *name* holding a **different
   value per environment**. In the Vercel UI that means adding each name twice,
   ticking Production on one entry and Preview on the other — ticking both boxes
   on one entry gives them the same value, which is not what you want here.

   | Variable | Production | Preview | Must the values differ? |
   |---|---|---|---|
   | `POGO_BOT_USER_ID` | prod bot's UUID | preview bot's UUID | **Yes.** Separate Supabase projects → separate auth users. A prod UUID on preview fails the FK. |
   | `POGO_CRON_SECRET` | random string | a *different* random string, or unset | No, but do it anyway. |

   **About `POGO_CRON_SECRET`.** Unlike everything else in this list, it is a
   value *you invent* — nothing issues it. Generate one with:

   ```bash
   openssl rand -hex 32
   ```

   It exists because `/api/cron/pogo-feed` is a public URL, and anyone who found
   it could make the bot post. The usual "are you logged in?" check is no help:
   the caller is a GitHub server with no session, and `src/proxy.ts` excludes
   `/api` from the middleware matcher, so the route gets no guard by default. The
   shared secret is how the route recognises its own scheduler — GitHub sends it
   as an `x-cron-secret` header, the route compares it (constant-time, so a wrong
   value can't be recovered by timing the response) and answers `401` on a
   mismatch.

   The same string goes in **two places**: here, and as a GitHub repo secret in
   step 5. They must match character-for-character or every run 401s.

   For **Preview**, either leave it unset (the route answers `503` and the bot
   just doesn't run there — nothing automated calls preview) or set a *different*
   random value if you want to `curl` a preview deploy by hand. Don't reuse the
   prod value.

5. **GitHub repo secrets** (Settings → Secrets and variables → Actions). Only
   one secret here, not one per environment — the workflow only ever calls prod:
   - `POGO_CRON_SECRET` — the identical string you put in Vercel's **Production**
     scope in step 4. Preview's value never goes into GitHub.
   - `POGO_CRON_URL` — the prod origin, no trailing slash:
     `https://pogosundet.vercel.app`

     Use the **stable production alias** above, not a per-deployment URL like
     `pogosundet-a1b2c3.vercel.app` — those are pinned to one build and go stale
     the moment you deploy again. If a custom domain is ever added (see the
     Google-login item in `docs/launch-checklist.md`), update this secret to
     match; nothing else needs changing.

Both env vars must be set or the route answers `503 not_configured` and posts
nothing. That is the intended "off" state — an unset secret disables the
endpoint rather than opening it.

> **Set the env vars BEFORE merging the PR.** Vercel does not apply an env-var
> change to a deployment that is already running — per their docs, "changes to
> environment variables are not applied to previous deployments." Setting them
> first means the merge's own deploy picks them up. Set them afterwards and you
> must redeploy manually, or the route keeps answering `503` and it looks broken.

**Rotating the secret later:** change it in both places, then redeploy. The
workflow will 401 for the gap between the two edits — harmless, since the poll is
stateless and the next run resumes where it left off.

## Running it by hand

GitHub → Actions → **PoGo event feed** → Run workflow. Or locally:

```bash
curl -X POST http://localhost:3000/api/cron/pogo-feed -H "x-cron-secret: $POGO_CRON_SECRET"
```

The response says what happened: `{ ok, eventsPosted, rotationPosted, seeded, notes }`.

## The first run seeds silently

On a cold start the ledger is empty and the feed holds ~40 events. Posting those
would dump the entire LeekDuck calendar into chat as the bot's opening act, so
the first run records every event ID and posts **nothing**. From then on only
genuinely new IDs are candidates.

Consequence: after setup, expect one rotation post and no event posts. That is
correct, not a bug.

To re-test the posting path, delete a couple of rows and run again:

```sql
delete from public.pogo_feed_posted_events
 where event_id in ('<some-id>', '<another-id>');
```

## Anti-spam rules

All in `src/lib/pogo-feed/diff.ts`, all unit-tested:

| Rule | Value | Why |
|---|---|---|
| Cold start seeds silently | — | Stops a 40-message opening burst |
| Max posts per run | 5 | Caps a burst if the feed adds many at once |
| Max lead time | 30 days | An event two months out isn't news yet |
| Ended events skipped | — | The feed keeps recently-finished events |
| Rotation posts on change only | fingerprint | Not once per poll |

Only events that can **never** become announceable — wrong type, or already
over — are written to the ledger without posting. Two cases are deliberately
left unrecorded so they come back later:

- overflow beyond the per-run cap (posts next run)
- events still outside the 30-day window (post when the date nears)

Recording either would mark it handled forever and silently eat the
announcement. The feed carries raid days two months out, so that is a real case.

**The ledger read is scoped to the current feed** (`getPostedEventIds` takes the
feed's event IDs and uses `.in(...)`). An unbounded select would eventually cross
PostgREST's default 1000-row cap and start dropping rows, making old events look
new — a bug that would first appear years from now. Cold-start detection uses a
separate `head: true` count, because "none of these 40 are known" is not the same
as "the ledger is empty".

**Claiming is a plain INSERT, not an upsert.** The primary-key violation is the
point: it makes the ledger row a lock, so if two runs ever overlap, exactly one
wins the claim and posts. `markEventsPosted` (the batch seed path) still uses
`ignoreDuplicates`, since nothing is posted there.

## Which events get posted

`POSTABLE_EVENT_TYPES` in `src/lib/pogo-feed/types.ts`:

```ts
['raid-day', 'raid-hour', 'raid-battles', 'elite-raids']
```

Deliberately raids-only — these are the events people physically gather for.
`community-day` is knowingly excluded. To widen it, add to that array and update
the test in `diff.test.ts` that pins the list. The feed carries ~14 types.

## The bot account is hidden

`profiles.is_bot` (migration 023) filters it out of `getAllProfiles`
(`src/lib/profile/server-helpers.ts`) and `getMemberCount`
(`src/lib/chat/server-helpers.ts`). Between them those cover `/players`, the
online strip, the channel members sheet, the DM picker and the "X medlemmer"
badge.

One subtlety, and it bites in **two** places: server-rendered messages resolve
their author through the PostgREST embed on `channel_messages_profile_fk`, but a
**Realtime INSERT carries no join** — the client resolves it from the profile
snapshot, which excludes the bot. So `getBotProfiles()` is fetched separately and
merged into the author lookup **only**, never into the `profiles` list the strip,
members sheet and member count render from:

- `ChannelScreen` (`botProfiles` → `profileById`) — inside a channel; without it
  a live bot message shows "—" and a "?" avatar.
- `ChannelListScreen` (`botProfiles` → `nameById`) — the `/chat` row preview;
  without it the row reads "—: ⚔️ Groudon …".

Anything else that resolves an author name from `getAllProfiles()` needs the same
treatment. Both are covered by component tests that assert the dash-fallback
failure explicitly, so the two can't drift apart again.

## Troubleshooting

**The bot went quiet.** Check GitHub → Actions first. GitHub disables scheduled
workflows after 60 days with no commits to the repo (it emails first). This is
the most likely cause, and nothing in the app will show an error.

**Posts are late.** Expected. GitHub's scheduled runs are best-effort and often
5–15 minutes behind. The feed itself only updates every 10 minutes.

**`503 not_configured`.** `POGO_CRON_SECRET` or `POGO_BOT_USER_ID` is unset on
that deployment. If you're sure you set them, check *when*: Vercel only applies
env-var changes to new deployments, so a variable added after the last deploy
isn't live yet. Redeploy and try again.

**`401 unauthorized`.** The `POGO_CRON_SECRET` in GitHub secrets doesn't match
Vercel's Production value. The gate is fail-closed by design — unlike the
notify-* Edge Functions, which are fail-open because an unset secret there must
never silence push. This endpoint writes to chat, so an unset secret means
"off", not "open".

**A 401 that returns HTML instead of JSON is not this endpoint.** That's Vercel
Deployment Protection rejecting the request before it ever reaches the app —
check Project → Settings → Deployment Protection. Our gate always answers JSON
(`{"error":"unauthorized"}`), so the response body tells you which layer said no.

**A duplicate post appeared.** Shouldn't be possible: the ledger row is written
before the message. If it happens, check whether two runs overlapped — the
workflow has a `concurrency` group to prevent that.

## Not built

- Event images. Chat has no image rendering, and `next.config.ts`
  `images.remotePatterns` only allows `*.supabase.co`; adding `cdn.leekduck.com`
  is a load-bearing config change. Text + link only.
- Push notifications for bot posts.
- Editing or retracting a bot post — `channel_messages` has no UPDATE/DELETE
  policy by design.
- The Q&A half of the original brief. Designed but deferred; see the plan file.
  Note it needs a Privacy Policy update, because sending member questions to an
  LLM is new third-party processing of user-generated content.
