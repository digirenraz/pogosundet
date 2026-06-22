# Plan: "Kom i gang" getting-started guide

Source: Claude Design handoff `Kom i gang.dc.html` (project `Desktop onboarding and integration guide`,
`87417b92-bdba-4a06-b755-ce5ab4455133`).

## What it is
A "Velkommen til PoGoSundet" getting-started page with two sections:
1. **Installér PoGoSundet på din telefon** — Android (Chrome) + iOS (Safari) install steps, in two cards.
2. **Tilføj venner med QR** — 5-step walkthrough of the desktop scan-session, with a replica of the
   scan panel (avatar + QR + friend code + copy button) on the right.

## Decisions (confirmed with PM)
- **Entry point:** a new **"Kom i gang" item in the desktop sidebar** (bottom group, above "Nyheder").
  For mobile reachability, also add it to the **AppMenu hamburger** dropdown (top item).
- **Responsive:** desktop sidebar layout at `lg+`; clean single-column on mobile (AppHeader + BottomNav).

## Files
- `src/app/[locale]/onboarding/page.tsx` — NEW route `/onboarding`. Server component: auth-guard
  (`getClaims()` → redirect `/login`), fetch own profile for the sidebar chip, render via `DesktopShell`.
  Exports `preferredRegion = 'dub1'` (makes Supabase calls).
- `src/components/onboarding/GettingStartedGuide.tsx` — NEW client component. The full guide content,
  responsive padding. Copy-button state (sample friend code). Reuses `FriendCodeQR` for the QR replica
  (no image asset needed). All strings via `useTranslations('Onboarding')`.
- `src/components/desktop/DesktopSidebar.tsx` — add a "Kom i gang" `<Link>` (Rocket icon) in the bottom
  group above "Nyheder", with active styling on `/onboarding`.
- `src/components/AppMenu.tsx` — add a "Kom i gang" `<Link>` as the first dropdown item (mobile entry).
- `messages/da.json` + `messages/en.json` — new `Onboarding` namespace (all guide strings, da primary /
  en stub). Bold emphasis via `t.rich` with a shared `<b>` chunk.
- `src/lib/changelog/entries.ts` — prepend a Danish changelog entry (user-facing feature).
- `e2e/getting-started.spec.ts` — env-gated login → open `/onboarding` → assert headings + a tab.

## Color mapping (design hex → token)
`#00b09f`→primary · `#ccefeb`→secondary · `#fbfaf9`→card · `#e8e8e8`→border · `#949494`→muted-foreground.
Brand-ink `#0a1f27`/`#1f2a2e` have no token (foreground is pure black) → hardcoded, per AppHeader precedent.
Info/tip callout colors (`#fff7ec`/`#f6e2c6`/`#d97a17`, `#e6f4f2`/`#c7e7e1`/`#00897c`) hardcoded from the handoff.

## Verify
`tsc` + `eslint` + `npm run build` + unit tests green. Visual check at 1280 (desktop) and 390 (mobile)
via Playwright preview route / dev. e2e is env-gated (auth).
