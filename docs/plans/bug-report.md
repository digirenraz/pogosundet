# In-app bug reports → GitHub issues (issue #126)

**Branch:** `slice/bug-report`

## Goal

A "Rapportér en fejl" option in the same hamburger menu as the changelog (issue #112's
`AppMenu`). The user enters a title and description; submitting creates a GitHub issue
in `digirenraz/pogosundet` (private repo), labelled `user-report` (label already created).

## Architecture

The GitHub token is a secret, so issue creation happens in a **server route handler**:

- **`src/app/api/bug-report/route.ts`** — `POST`, `export const preferredRegion = 'dub1'`.
  1. Verify session (`createClient()` from `@/lib/supabase/server` → `auth.getClaims()`;
     401 if none) — mirrors `src/app/api/account/delete/route.ts`.
  2. Validate body with the shared pure helper (400 on failure).
  3. Fetch the reporter's `trainer_name` from `profiles` (by `user_id`); fall back to
     "ukendt" if missing.
  4. `POST https://api.github.com/repos/digirenraz/pogosundet/issues` with
     `Authorization: Bearer ${process.env.GITHUB_BUG_REPORT_TOKEN}`,
     `Accept: application/vnd.github+json`. Payload: user's title verbatim,
     body = description + `\n\n---\nRapporteret af **<trainer_name>** via appen.`,
     `labels: ['user-report']`.
  5. Missing/empty token → 503 `{ error: 'not_configured' }` (code no-ops without the
     key, like Sentry/Amplitude). GitHub non-2xx → 502 `{ error: 'github_failed' }`
     (log the status, never the token). Success → 201 `{ ok: true }`.

- **`src/lib/bug-report/validation.ts`** — pure, TDD first:
  `validateBugReport({ title, description })` → trims, requires title 3–100 chars,
  description 10–2000 chars; returns `{ ok: true, title, description }` or
  `{ ok: false, error: 'title' | 'description' }`. Used by BOTH the route handler and
  the client form (single source of truth).
  Tests in `src/lib/bug-report/validation.test.ts` (too short/long, trimming,
  happy path, whitespace-only).

## UI

- **`src/components/AppMenu.tsx`** — second dropdown item under "Nyheder":
  "Rapportér en fejl" (lucide `Bug` icon) → opens `BugReportSheet`.
- **`src/components/BugReportSheet.tsx`** — bottom sheet, same chrome as
  `ChangelogSheet` (backdrop, `max-w-[480px]`, rounded-t-2xl, Escape/backdrop close,
  X button). Content:
  - Title text input + description textarea (styling consistent with existing inputs,
    e.g. AuthInput / ProfileForm fields — plain Tailwind, labels above).
  - A short muted disclaimer paragraph: the report (incl. trainer name) is sent
    privately to the developers via GitHub — don't include personal information.
  - Submit button (PrimaryButton styling or equivalent): disabled until
    `validateBugReport` passes; "Sender…" while in flight; on success replace the form
    with a thank-you state + a close button; on error show an inline error line and
    keep the form (text preserved).
  - Form state resets when the sheet fully closes after success.

## i18n

New `BugReport` namespace in `messages/da.json` + `messages/en.json`:
`menuItem` ("Rapportér en fejl"), `sheetTitle`, `titleLabel`, `titlePlaceholder`,
`descriptionLabel`, `descriptionPlaceholder`, `disclaimer`, `send` ("Send"),
`sending` ("Sender…"), `successTitle` ("Tak!"), `successBody` (report received, we'll
look at it), `errorGeneric` (couldn't send, try again later), `close` ("Luk").

## GDPR

GitHub (US) becomes a processor of the report text + trainer name. Update Privacy
Policy §7 (`Privacy.s7Body` in da + en): add a sentence that bug reports submitted in
the app are stored in our private issue tracker on GitHub and contain only what the
user writes plus their trainer name. Bump `Privacy.lastUpdated` to 2026-06-10 (da+en).
The in-form disclaimer warns against writing personal info.

## Ops (PM, after merge — mirror in docs/launch-checklist.md)

Create a fine-grained GitHub PAT scoped to `digirenraz/pogosundet` with
**Issues: Read and write** only, add as `GITHUB_BUG_REPORT_TOKEN` in Vercel
(Production + Preview). Document in `.env.local.example`. Until set, the form shows
the generic error (and the route answers 503).

## Changelog

Prepend to `src/lib/changelog/entries.ts` (process rule):
"Du kan nu rapportere fejl direkte fra appen: Tryk på menuen øverst til venstre og
vælg \"Rapportér en fejl\"."

## Tests

- `validation.test.ts` — TDD, pure helper.
- `BugReportSheet.test.tsx` — component test (NextIntlClientProvider + da messages,
  mocked `fetch`): send disabled until valid, success path renders thank-you, 503/500
  path renders error and keeps input values.
- `e2e/bug-report.spec.ts` — env-gated login (profile-edit pattern). Use
  `page.route('**/api/bug-report', …)` to stub a 201 so NO real GitHub issue is
  created: open hamburger → "Rapportér en fejl" → fill title + description → send →
  thank-you visible → close.
- AppMenu component test: extend existing `AppMenu.test.tsx` with "menu shows the bug
  report item".

## Out of scope

- Screenshots/attachments, device metadata, rate limiting (auth-gated, community scale).
- Email notifications to the PM (GitHub already notifies).

## Verification

`npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, full e2e suite
locally (logged-out baseline). Real GitHub round-trip needs the token → verified on
prod after the PM adds it (launch-checklist item), or locally if a token is provided.
