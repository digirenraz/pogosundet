# Plan: Branded app header (icon + PoGoSundet wordmark + large title)

Design handoff: `design_handoff_branded_header` (icon + wordmark in a top row, screen
name as a large 26px title below). Scope (PM-confirmed): **branded header on the four
top-level mobile tab screens only** — Players, Raids, Chat, Profil. Compact variant and
secondary-screen back-arrow headers are out of scope.

## Design spec (mobile)
Header block: `bg-card`, 1px `border-border` bottom, padding `10px 14px 12px`.
- **Row 1** (`flex items-center justify-between`):
  - Left lockup (`gap 9px`): hamburger (lucide `Menu`, reuse `AppMenu`) → 30px app icon
    (`rounded-lg`, shadow `0 2px 5px rgba(10,34,43,.22)`) → wordmark "PoGoSundet"
    (17px / extrabold / `-0.02em` / `#0a222b`).
  - Right: optional action (Raids' existing `+` link — 40px primary circle). Omitted on
    screens with no primary action (lockup stays left-aligned).
- **Row 2** large title: screen name, 26px / extrabold / `-0.02em` / `#0a1f27`, `mt-3 mx-0.5`.

Brand-ink hex (`#0a222b`, `#0a1f27`) have no `@theme` token (foreground is pure black) →
hardcode per the handoff. Wordmark is a proper noun → hardcoded constant, no i18n key.
Icon source: `/icon-192.png` (the real shipped home-screen icon) via `next/image`.

## Files
- **New** `src/components/AppHeader.tsx` — `AppHeader({ title, action? })`, fixed, renders
  the branded mobile chrome. Reuses `AppMenu` for the hamburger.
- `src/components/DirectoryHeader.tsx` — render `<AppHeader title={t('headerTitle')} />`.
- `src/components/PlayersScreen.tsx` — bump mobile `<main>` top padding.
- `src/app/[locale]/profile/page.tsx` — replace inline header with `AppHeader`; bump `pt`.
- `src/app/[locale]/raids/page.tsx` — mobile branded `AppHeader` (with `+` action,
  `lg:hidden`) + keep existing simple header `hidden lg:flex` for desktop (sidebar already
  brands desktop); content `pt-[112px] lg:pt-[76px]`.
- `src/components/chat/ChannelListScreen.tsx` — same mobile/desktop split as Raids (no
  action).
- 4 loading skeletons (`players`, `raids`, `chat`, `profile`) — mirror the taller branded
  header so segment transitions stay shift-free.

Desktop note: Players/Profil already isolate mobile in an `lg:hidden` block (desktop uses
`DesktopSidebar`), so `AppHeader` is naturally mobile-only there. Raids/Chat render one
shared tree inside `DesktopShell`, so they get the mobile branded header `lg:hidden` plus a
`hidden lg:flex` desktop header (today's behaviour preserved).

Exact `pt` offset (header height) verified in-browser via Playwright after build.

## Verification
- `npm run build` + `tsc` + lint + unit tests green.
- Playwright MCP visual check at a phone viewport on all four tabs; measure header height,
  tune content `pt` to be shift-free. Add/extend an e2e spec asserting the wordmark renders.
- Changelog entry (user-facing) prepended to `src/lib/changelog/entries.ts`.
