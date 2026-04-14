# PoGoSundet — Claude Code Project Guide

This file is read automatically at the start of every Claude Code session.
Do not delete it. Update it at the end of each session if any decisions changed.

---

## Project overview

**PoGoSundet** is a mobile-friendly web app for the local Pokémon GO community in
Frederikssund, Denmark. It lets players create profiles, find each other, share
Trainer Codes, and — in Phase 2 — coordinate raids, meetups, and trades.

The product owner is a non-technical product manager. Claude Code is the
primary implementation tool. Code must be clean, well-commented, and easy to
hand off to a future developer.

---

## Tech stack (locked — do not change without explicit instruction)

| Layer       | Choice                          | Notes                                      |
|-------------|----------------------------------|---------------------------------------------|
| Frontend    | Next.js (App Router)            | Single codebase, mobile-first               |
| Backend/DB  | Supabase                        | EU/Ireland region — required for GDPR       |
| Auth        | Supabase Auth                   | Google OAuth + email/password in Phase 1    |
| Hosting     | Vercel                          | Free tier adequate for initial scale        |
| i18n        | next-intl                       | Danish-first; architecture supports more    |

**Do not suggest alternative frameworks, ORMs, or services** unless there is a
concrete blocker. When in doubt, ask before introducing a new dependency.

---

## Auth decisions (Phase 1)

- ✅ Google OAuth — implement in Phase 1
- ✅ Email/password — implement in Phase 1
- ❌ Facebook Login — deferred until after Phase 1 is stable (app review complexity)

---

## Phase plan

### Phase 1 — current focus
User profiles and community discovery:
- Registration and login (Google OAuth + email/password)
- User profile: trainer name, level, team (Mystic/Valor/Instinct), area, Trainer Code
- Browse and search community members
- Display Trainer Code (for use inside Pokémon GO — not an in-app social graph)
- GDPR compliance (see below)

### Phase 2 — do not build yet
- Raid coordination and remote RSVPs
- Chat / messaging
- Trade requests
- Push notifications
- Admin roles and moderation tools

**If a Phase 1 feature would require significant refactoring to support Phase 2,
flag it and ask. Otherwise, do not pre-build Phase 2 functionality.**

---

## GDPR requirements (Phase 1 — non-negotiable)

Denmark is in the EU. All of the following are required before launch:

- [ ] Privacy Policy page (Danish language)
- [ ] Explicit consent checkbox at registration (not pre-ticked)
- [ ] All user data stored in Supabase EU/Ireland region
- [ ] Account deletion: user can delete their own account and all associated data
- [ ] No third-party analytics or tracking without consent

When building any feature that touches personal data, ask: *does this comply
with the GDPR checklist above?*

---

## Location approach (Phase 1)

- **Manual text entry only** — user types their area (e.g. "Frederikssund centrum")
- No GPS, no geolocation API, no map integrations in Phase 1
- Store as a plain text field on the profile

---

## Language and i18n

- Default language: **Danish (da)**
- All UI strings must go through next-intl — no hardcoded Danish (or English) text
  in components
- Translation files live in `/messages/da.json` (and `/messages/en.json` as a
  stub for future use)
- Do not add a language switcher in Phase 1 — the architecture supports it,
  but the UI does not need it yet

---

## Coding standards

- Use **TypeScript** throughout — no plain `.js` files in `src/`
- Use **Tailwind CSS** for styling — no separate CSS files unless unavoidable
- Components go in `src/components/`, pages in `src/app/`
- Supabase client logic goes in `src/lib/supabase/`
- Keep components small and single-purpose
- Add a short comment at the top of any non-obvious function explaining *why*,
  not just *what*
- Prefer explicit over clever — this codebase may be read by a non-developer

---

## Testing strategy

- **Framework:** Vitest (introduced in Slice 2)
- **Approach:** Test-Driven Development (TDD) — write tests before implementation
- **Scope:** Core logic only — validation functions and Supabase data helpers
  - No UI component tests (too brittle, low value for this project)
  - No end-to-end tests in Phase 1
- **Test location:** co-located with the code they test, e.g. `src/lib/profile/validation.test.ts`
- **Run tests:** `npm run test` (single run) or `npm run test:watch` (watch mode)
- **Required:** all tests must pass before opening a PR — treat a failing test as a broken build

Apply TDD to every new slice: write the test file first, confirm tests fail, then implement.

---

## Git workflow

- `main` branch is always deployable
- One feature branch per vertical slice: `slice/1-registration`, `slice/2-profile`, etc.
- Open a PR to `main` when a slice is complete
- Do not commit directly to `main`
- Commit messages: short, imperative, in English (e.g. `Add Trainer Code display`)

---

## Vertical slices (ordered)

Work through these in order. Do not start a new slice until the current one is
merged to `main`.

1. **Registration & auth** — sign up, log in, log out (Google + email/password)
2. **Profile creation** — trainer name, level, team, area, Trainer Code
3. **Profile display** — public profile page per user
4. **Community browser** — list/search all players
5. **GDPR & legal** — Privacy Policy, consent, account deletion

*(Slice order may be adjusted, but only with explicit instruction.)*

---

## Scale and cost constraints

- Target: 20–200 users initially, Frederikssund only
- Supabase free tier is acceptable for Phase 1
- Vercel free tier is acceptable for Phase 1
- Do not add services, queues, caches, or background workers unless a concrete
  problem requires them

---

## Decisions log

Update this section at the end of each session.

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
| 2026-04-11 | Banani Mint theme applied (teal #00b09f, Inter font)  | Locked design from Banani flow RZeh9aYzjISm           |
| 2026-04-14 | Profile fields follow Banani (trainer name, friend code, first name, bio) | Level/Team/Area not in Banani design — deferred |
| 2026-04-14 | No second GDPR consent on profile setup screen        | Consent already collected at registration (Slice 1)   |
| 2026-04-14 | TDD with Vitest introduced in Slice 2                 | Core logic tested: validation + Supabase helpers      |
| 2026-04-14 | Slice 2 implemented on branch slice/2-profile         | profiles table + RLS created in Supabase manually     |
| 2026-04-14 | Slices 3+4 merged — Player Directory is the main screen | Banani design combines profile display + community browser |
| 2026-04-14 | Bottom nav added: Players + Profile active, Raids/Chat placeholder | Phase 2 features; nav hints at future scope |
| 2026-04-14 | Home page is now logged-out only; logged-in → /players | Clean routing model for bottom nav active states |
| 2026-04-14 | Server-only helpers in server-helpers.ts (separate from helpers.ts) | Prevents server imports leaking into client bundles |

---

## Open questions

None.

---

## How to work with me

- I am a product manager, not a coder. Explain technical decisions briefly.
- Before making an architectural choice not covered here, **ask first**.
- If a task is ambiguous, **ask one clarifying question** before proceeding.
- At the end of each session, **update the Decisions Log** above with anything
  that was resolved.
- Keep responses practical. Prefer working code over lengthy explanation.
