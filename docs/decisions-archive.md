# Decisions archive

Older decisions log entries, archived from `CLAUDE.md` to keep that file scannable. Most of these are now reflected in the codebase or in the architecture/strategy sections of `CLAUDE.md`. Kept here for historical context.

The active log lives in `CLAUDE.md` and contains roughly the last 4 weeks of decisions.

---

| Date       | Decision                                              | Reason                              |
|------------|-------------------------------------------------------|--------------------------------------|
| 2026-03-29 | Supabase EU/Ireland region selected                   | GDPR compliance                      |
| 2026-03-29 | Facebook Login deferred post-Phase 1                  | App review complexity                |
| 2026-03-29 | Location = manual text entry, no GPS                  | Simplicity for Phase 1               |
| 2026-03-29 | "Add Friends" = display Trainer Code only             | No in-app social graph in Phase 1    |
| 2026-03-29 | Profile photo storage approach not yet resolved       | Open question — decide before Slice 2|
| 2026-04-11 | Profile photos stored in Supabase Storage             | Keeps stack simple; free tier sufficient for Phase 1 |
| 2026-04-11 | Slice 1 implemented on branch slice/1-registration    | Awaiting Supabase + Google OAuth setup before testing |
| 2026-04-11 | GitHub repo created at github.com/digirenraz/pogosundet | Private repo; main + slice/1-registration pushed     |
| 2026-04-11 | Next.js 16 uses proxy.ts instead of middleware.ts     | Framework renamed middleware convention in v16        |
| 2026-04-11 | Password reset included in Slice 1                    | Keeps "Forgot password?" link in Banani design honest |
| 2026-04-11 | GDPR consent checkbox + /privacy stub in Slice 1      | Non-negotiable before any registration can go live    |
| 2026-04-11 | Mint theme applied (teal #00b09f, Inter font)         | Locked design from original Claude Design handoff     |
| 2026-04-14 | Profile fields: trainer name, friend code, first name, bio | Level/Team/Area not in original design — deferred |
| 2026-04-14 | No second GDPR consent on profile setup screen        | Consent already collected at registration (Slice 1)   |
| 2026-04-14 | TDD with Vitest introduced in Slice 2                 | Core logic tested: validation + Supabase helpers      |
| 2026-04-14 | Slice 2 implemented on branch slice/2-profile         | profiles table + RLS created in Supabase manually     |
| 2026-04-14 | Slices 3+4 merged — Player Directory is the main screen | Design combines profile display + community browser |
| 2026-04-14 | Bottom nav added: Players + Profile active, Raids/Chat placeholder | Phase 2 features; nav hints at future scope |
| 2026-04-14 | Home page is now logged-out only; logged-in → /players | Clean routing model for bottom nav active states |
| 2026-04-14 | Server-only helpers in server-helpers.ts (separate from helpers.ts) | Prevents server imports leaking into client bundles |
| 2026-04-14 | Logout accessible via dropdown on green icon in DirectoryHeader | No dedicated logout page; keeps UI clean |
| 2026-04-17 | Privacy Policy written in Danish, data controller: René Rasmussen (renraz@gmail.com) | GDPR Art. 13 requirement |
| 2026-04-17 | Account deletion via POST /api/account/delete using service role key | Client SDK cannot delete auth users; server route required |
| 2026-04-17 | Profile row deleted via ON DELETE CASCADE (already on FK) — no extra migration needed | Cascade was set up in Slice 2 migration |
| 2026-04-17 | SUPABASE_SERVICE_ROLE_KEY required in .env.local for account deletion | Must be added to Vercel env vars before deploy |
| 2026-04-19 | Raid MVP added as Slices 6–8; launch blocker, not Phase 2 | Without raid coordination, community won't return to the app |
| 2026-04-19 | Raid list is intentionally minimal: one list, newest first, auto-hide ~45 min after start | Handful of raids/day; filters/search/sort add no value |
| 2026-04-19 | Raid MVP excludes chat, remote lobby codes, recurring raids, history, filters | Keep it faster than the Messenger screenshot workflow (chat later added 2026-04-29) |
| 2026-04-19 | Push notifications via self-hosted web-push + Supabase Edge Function (not OneSignal) | Stays in existing stack; 20–200 users doesn't justify third-party service |
| 2026-04-19 | PWA required for push notifications (iOS 16.4+ only works when installed to home screen via Safari) | Platform constraint, not a choice |
| 2026-04-19 | iOS "Add to Home Screen" onboarding designed in Claude Design | Needs explanatory/instructional visuals, not standard UI screens |
| 2026-04-19 | iOS onboarding must instruct Chrome users to switch to Safari first | Chrome on iOS doesn't expose the PWA install flow that enables push |
| 2026-04-19 | Messenger cross-posting is a manual "Share to Messenger" button, not automated | Messenger has no public group-posting API; deep link + poster's tap is the realistic path |
| 2026-04-19 | Raid post form: screenshot is the primary input, all other fields optional | Matches existing community workflow — take screenshot, post with short note |
| 2026-04-19 | Share button uses Web Share API with clipboard copy fallback | Works natively on Android; on desktop falls back to copying text |
| 2026-04-19 | Active raid filter initially tried Supabase .or() with dynamic 45-min threshold | COALESCE(starts_at, created_at) not directly expressible in SDK; later replaced with JS filter |
| 2026-04-19 | Slice 6 implemented on branch slice/6-raids | raids + raid_attendees tables; Supabase Storage bucket raid-images must be created manually |
| 2026-04-19 | Raid start time options: Nu / +5 min / +10 min / +15 min | Tighter range fits real raid coordination better than the original +30/+60 options |
| 2026-04-19 | Active raid filter uses client-side JS, not PostgREST .or() | PostgREST timestamp syntax in .or() failed silently; JS filter on server is reliable and testable |
| 2026-04-19 | FK added from raid_attendees.user_id to profiles.user_id | Required for Supabase embedded query profiles(trainer_name) to work; profiles.user_id is unique |
| 2026-04-19 | Supabase Storage bucket raid-images needs two manual policies | INSERT for authenticated users, SELECT for public — not set automatically on bucket creation |
| 2026-04-29 | Extra player count on RSVP (raid_attendees.extra_count) | Posters/joiners can say "Jeg er med + 2 ekstra"; total trainer count shown on card |
| 2026-04-29 | Raid detail screen at /raids/[id] — hero image, RSVP, attendees, chat | Tap card → detail. (Originally specified 10s chat polling; superseded by Supabase Realtime on 2026-05-06.) |
| 2026-04-29 | Boss field replaced with BossSearch autocomplete (full Pokémon list in pokemon.ts) | Dropdown was too rigid; search works for any boss including future rotations |
| 2026-04-29 | Gym field replaced with GymSearch (OSM Overpass API, cached, freeform fallback) | User confirmed OSM in design session; overpass-api.de, 25km radius around Frederikssund |
| 2026-04-29 | Poster is auto-joined to raid_attendees on submit (with extra_count) | Needed so poster's name appears in attendee list and totalTrainers count is accurate |
| 2026-04-29 | "Sluttede raids" section shows expired raids (45min–2h) greyed out inline | Cards go opacity-50 + grayscale; no RSVP strip; getRecentRaids returns both active+expired |
| 2026-04-29 | Migration 003 must be run manually in Supabase SQL editor | Adds extra_count to raid_attendees + creates raid_messages table with RLS |
| 2026-04-29 | Slice 8 implemented: push_subscriptions table, PushSubscribePrompt banner, Edge Function notify-raid | Web push via self-hosted VAPID; Edge Function deployed manually with `supabase functions deploy notify-raid` |
| 2026-04-29 | supabase/functions/ excluded from tsconfig.json | Deno Edge Function uses npm: specifiers unsupported by Next.js TypeScript checker |
| 2026-04-29 | Privacy Policy updated to section 11 disclosing push subscription data; lastUpdated bumped to maj 2026 | GDPR requirement — push endpoint + keys are personal data |
| 2026-04-29 | PushSubscribePrompt only shows in standalone PWA mode (display-mode: standalone) | Push only works reliably when PWA is installed; avoids misleading browser users |
| 2026-04-29 | Design tool: Claude Design (claude.ai/design) | Handoff bundles (gzip tar: README.md + HTML prototype + JSX) replace earlier Banani designs |
| 2026-04-29 | Chat added to Raid MVP | Claude Design handoff included per-raid chat; community needs it to replace Messenger |
| 2026-05-03 | Slice 7 PWA: manual sw.js (not next-pwa), manifest.json, icon.svg | next-pwa not needed for installability; sw.js extended in Slice 8 for push handler |
| 2026-05-03 | InstallPrompt component handles Android "Add to Home Screen" banner | iOS never fires beforeinstallprompt — iOS users use /onboarding/ios guide instead |
| 2026-05-03 | PWA icon is placeholder SVG — replace before launch | Real branded PNG icons (192×192, 512×512) needed. Resolved 2026-05-19 (see active log). |
