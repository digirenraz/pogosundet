<!--
PoGoSundet PR template. Keep it short — fill in "What & why", then tick the
checklist. Items that don't apply: leave the box unticked is fine, EXCEPT the
Migration item, which the CI "Migration safety guard" enforces when this PR
touches supabase/migrations/ (see CLAUDE.md → Database migrations).
-->

## What & why

<!-- One or two sentences. Link the issue, e.g. "Closes #123". -->

## Checklist

- [ ] **Migration** — this PR changes nothing under `supabase/migrations/`, **or** the migration has been applied to the **prod** Supabase SQL editor before merge per the apply-before-merge rule (CLAUDE.md → Database migrations). <!-- migration-applied -->
- [ ] **Changelog** — a user-facing feature/fix prepends a Danish entry to `src/lib/changelog/entries.ts` (skip for doc-only / refactor / invisible-infra).
- [ ] **Service worker** — any change to `public/sw.js` behaviour bumps its cache-version constant (`SHELL_CACHE` / `RUNTIME_CACHE`).
- [ ] **`dub1` region** — every new server route / Server Component that makes Supabase calls exports `preferredRegion = "dub1"` (not inherited).
- [ ] **i18n** — no hardcoded user-facing strings; new keys added to `messages/da.json` (+ `messages/en.json`).
- [ ] **Privacy / GDPR** — a new personal-data field or third-party service updates the Privacy Policy and bumps `Privacy.lastUpdated`.
- [ ] **Tests green** — `npm run lint`, `npm run typecheck`, and `npm run test` pass locally.
