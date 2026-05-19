# PoGoSundet — Developer Onboarding

Welcome. PoGoSundet is a mobile-first PWA for the Pokémon GO community in Frederikssund, Denmark — players create profiles, find each other, share Trainer Codes, coordinate raids, and chat. This page gets you productive in an hour. For first-time env/Supabase/Google OAuth setup see [`setup.md`](setup.md); for pre-launch ops see [`launch-checklist.md`](launch-checklist.md); for architectural decisions see [`../CLAUDE.md`](../CLAUDE.md) and [`decisions-archive.md`](decisions-archive.md).

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript | Single codebase, SSR, RSC, streaming |
| Hosting | Vercel — region **`dub1`** (Dublin) | Co-located with Supabase EU |
| Backend / DB / Auth | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions), region **eu-west-1 (Ireland)** | GDPR-mandatory EU residency |
| Styling | Tailwind v4 | `@theme` tokens; some CSS vars live in `:root` (see Decisions log) |
| i18n | next-intl, default `da`, `localePrefix: 'as-needed'` | Danish-first, multi-locale ready |
| PWA / Push | Manual `sw.js` + `web-push` via Supabase Edge Function `notify-raid` | No `next-pwa` dependency |

**Stack is locked.** Do not introduce alternative frameworks, ORMs, or services without explicit sign-off from the product owner.

---

## Repo layout

```
src/
  app/[locale]/         All user-facing pages (localised routes)
  app/api/              Route handlers (server-only)
  app/auth/             OAuth + email confirm callbacks
  lib/supabase/         client.ts / server.ts / admin.ts — NEVER mix
  lib/profile/          Profile domain (validation, helpers, presence)
  lib/raids/            Raid domain (validation, helpers, realtime hook)
  lib/push/             Web Push subscription helpers
  lib/account/          Account deletion (admin client)
  lib/hooks/            Shared React hooks (useMounted, etc.)
  i18n/                 next-intl config
  proxy.ts              Next 16 middleware: Supabase session + locale routing
messages/               da.json (primary), en.json (stub) — all UI strings
supabase/migrations/    SQL files — apply manually via Supabase SQL editor
supabase/functions/     Edge Functions (deployed via Supabase CLI)
e2e/                    Playwright specs
docs/                   This folder
```

### Three Supabase clients — never mix
- `lib/supabase/client.ts` — browser only (Client Components)
- `lib/supabase/server.ts` — Server Components, Route Handlers (uses cookies)
- `lib/supabase/admin.ts` — service role; privileged ops only (account deletion, cached reads outside request context). **Never import in client code.**

### Conventions that bite if you skip them
- Every Server Component page and Route Handler that talks to Supabase must `export const preferredRegion = "dub1"`. Not inherited.
- Use `getClaims()` for auth on pages (local JWT verify); reserve `getUser()` for middleware (refreshes token) and privileged routes (`/api/account/delete`).
- Profile-existence guard runs once in `lib/supabase/middleware.ts` — don't repeat it in pages.
- Client-only gating (localStorage/navigator/matchMedia) → `useMounted` hook, not `useState + useEffect`.
- Ref writes go in `useEffect`, never during render (React 19 lint rule).
- All UI strings via next-intl. Hardcoded text fails review.

---

## Local development

```bash
npm install
npm run dev            # http://localhost:3000
npm run lint
npm run build && npm start
```

Prereqs in [`setup.md`](setup.md): Supabase project, Google OAuth, `.env.local` populated with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

**Realtime caveat:** Supabase Realtime cross-user delivery is unreliable in `npm run dev` / Turbopack. If a Realtime feature looks broken locally but the code is correct, push to a Vercel preview and verify there.

---

## Testing strategy

| Layer | Tool | Scope |
|---|---|---|
| Unit / logic | Vitest + jsdom + `@testing-library/jest-dom` | Pure functions, Supabase helpers; co-located `*.test.ts` |
| End-to-end | Playwright | One spec per user flow in `e2e/`; auto-starts the dev server |
| Manual browser verification | Playwright MCP (during development) | Any user-visible change — also captured as an `e2e/` spec |

```bash
npm run test                # vitest run
npm run test:watch
npx vitest run src/lib/profile/validation.test.ts
npm run test:e2e
npm run test:e2e:ui
npx playwright test e2e/smoke.spec.ts
```

**TDD for pure logic:** write the failing test first, then the implementation. **PR gate:** all tests green before opening a PR.

---

## CI/CD

- **CI** (`.github/workflows/ci.yml`): runs on every PR and push to `main` — Node 24, `npm ci`, lint, Vitest, Playwright (Chromium). Failed Playwright runs upload an HTML report as an artifact. Three repo secrets drive the e2e dev server: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **CD**: Vercel auto-deploys — every PR gets a preview URL, `main` deploys to production. There is no separate release step.
- **Commit author**: git `user.email` must be `renraz@googlemail.com` or Vercel blocks the deploy.
- **Database migrations**: SQL files in `supabase/migrations/` are reference only — apply manually in the Supabase SQL editor. There is no automated runner.
- **Edge Functions**: `npx supabase functions deploy notify-raid`.

---

## Git workflow

- `main` is always deployable. **Never commit directly to `main`.**
- One short-lived branch per slice/chore off `main`: `slice/N-name` or `chore/short-name`. Delete after merge.
- Don't start a new slice until the current one is merged.
- Commit messages: short, imperative, English (`Add Trainer Code display`).
- Update the **Decisions log** in `CLAUDE.md` at the end of each session if anything architectural changed.

---

## GDPR — non-negotiable

EU data residency (Supabase Ireland), explicit registration consent (no pre-tick), no third-party analytics, full account-deletion cascade, Danish Privacy Policy at `/privacy`. **Bump `Privacy.lastUpdated` in `messages/da.json`** whenever a new personal-data field, third-party service, or retention change ships.

---

## Where to ask

The product owner is non-technical. If a task is ambiguous, ask one clarifying question before coding. If you need an architectural choice not covered in `CLAUDE.md`, ask first — don't assume.
