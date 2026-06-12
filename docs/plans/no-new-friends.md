# Plan: "No new friends" — hide friend code (issue #101)

## Context
Issue #101 ("No new friends") + security review **Finding 3** (friend codes are visible to every logged-in member). Let a user opt out of showing their friend code. When enabled: other users see a **blurred placeholder** with the text **"Ønsker ikke nye venner lige nu"** instead of the QR/code, and **cannot see or copy** the code. The owner still sees and manages their own code.

## Key design decision — withhold the value, don't just blur
The issue says others must not be able to **see or copy** the code, so a CSS blur alone is insufficient (the value would still ship in the page payload). The friend code is **redacted server-side** (set to `null`) before the profile array is serialized to the client, so a hidden code never reaches another user's browser. The `hide_friend_code` boolean itself is non-sensitive and stays in the payload so the UI knows to render the placeholder.

**Viewer-aware redaction (important):** `/profile` → "Vis QR-kode" links to `/players/{own id}`, which is fed by the shared `getAllProfiles()`. So redaction must **never redact the viewer's own row** — otherwise the owner couldn't see their own QR. Redaction therefore happens per-request at the page level (where `currentUserId` is known), not inside the globally-cached `getAllProfiles`.

**Residual (documented, not fixed here):** a technical user could still read any `friend_code` by calling the Supabase REST API directly with the public anon key, because Postgres RLS is row-level (the `profiles` SELECT policy returns all columns) — column-level masking would need a view/RPC refactor. This slice fully satisfies the in-app requirement; the deeper column-level lockdown is a follow-up tied to Finding 3.

## Changes

### DB — migration 020 (apply BEFORE merge)
`supabase/migrations/020_hide_friend_code.sql`: `ALTER TABLE public.profiles ADD COLUMN hide_friend_code boolean NOT NULL DEFAULT false;`
Apply-before-merge ordering (like 015/017/018): the profile form's update and the redaction read this column against the shared DB.

### Types & validation
- `src/lib/profile/validation.ts` — add `hide_friend_code?: boolean` to `ProfileInput` (no validation rule needed; it's a boolean).
- `src/lib/profile/helpers.ts` — `Profile` already extends `ProfileInput`, so it inherits the field.

### Redaction helper (pure + tested)
- New `redactHiddenFriendCodes(profiles, viewerUserId)` in `src/lib/profile/server-helpers.ts` → returns a new array where `friend_code` is `null` for every profile with `hide_friend_code === true` whose `user_id !== viewerUserId`. Leaves `hide_friend_code` intact.
- Apply it in `src/app/[locale]/players/page.tsx` and `src/app/[locale]/players/[id]/page.tsx` right after `getAllProfiles()`, passing the current `userId`, before handing profiles to the client components.

### Edit toggle
- `src/components/ProfileForm.tsx` — add a toggle ("Vis ikke min venekode" / "Ønsker ikke nye venner lige nu") wired to `hide_friend_code`, included in the `onSubmit` payload. Shared form; defaults to the row's current value via `initialValues`.
- `src/app/[locale]/profile/edit/page.tsx` — pass `hide_friend_code` through `initialValues` and the submit handler (it already spreads `ProfileInput`).

### Display surfaces — show placeholder when hidden (other users only)
A small reusable `FriendCodeHidden` placeholder (blurred QR-sized box + centered "Ønsker ikke nye venner lige nu"). Used where another user's code/QR would show:
- `src/components/PlayerCard.tsx` — replace the code text + copy button.
- `src/components/PlayerDetailDeck.tsx` — replace the code + `FriendCodeQR` + copy button.
- `src/components/desktop/DesktopPlayers.tsx` — replace the QR + code + copy in the scan session (and mark the row so "skip/added" still works).
Each checks `profile.hide_friend_code` (true → placeholder). Because the value is already `null` after redaction, the copy button has nothing to copy anyway — the check is the guard.
- Owner-only surfaces (`DesktopProfile.tsx`, `/profile`, `/profile/edit`) keep the real code/QR and get a small "Skjult for andre" note when the toggle is on, so the owner knows it's active.

### i18n (da + en)
New keys: the toggle label/description, the placeholder text "Ønsker ikke nye venner lige nu", and the owner "Skjult for andre" note. Namespaces: `ProfileEdit`/`ProfileForm` for the toggle, a shared `Players`/`PlayerDetail` key for the placeholder.

### Privacy
Friend code is already-disclosed personal data; this only *reduces* exposure. Add a one-line note to the friend-code/visibility part of `Privacy` (da+en) and bump `lastUpdated` — light touch, GDPR-positive.

### Docs / process
- Changelog entry (user-facing) in `src/lib/changelog/entries.ts` (Danish).
- CLAUDE.md: migrations list (+020), decisions log.
- `docs/launch-checklist.md`: apply-020-before-merge item.

## Tests
- `src/lib/profile/server-helpers.test.ts` — `redactHiddenFriendCodes`: hides others' codes, keeps the viewer's own, leaves non-hidden untouched, preserves `hide_friend_code`.
- Component test: `PlayerCard` shows the placeholder (not the code/copy) when `hide_friend_code` is true.
- e2e (env-gated): toggle on in edit → reflected; (cross-user blur is hard to assert deterministically on the shared DB — keep to the toggle round-trip).

## Verification
`eslint` / `tsc` / `build` / unit tests green. Manual: enable the toggle on one account, view that player from another account → blurred placeholder, no copyable code; confirm the owner still sees their own QR via `/profile` → "Vis QR-kode".
