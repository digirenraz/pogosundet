# User-facing changelog (issue #112)

**Branch:** `slice/user-changelog`

## Goal

A user-facing changelog ("Nyheder") of features and user-visible bug fixes, in Danish,
1–2 sentences per entry. Hidden behind a hamburger menu at the start of the main header
on the four top-level screens. Seeded with the last 10 user-facing changes. Zero impact
on page load — entry content is loaded only when the user opens the log.

## Interpretation decisions

- "Before the main header on all pages" → a hamburger button at the **left edge of the
  fixed 60px header** on the four main tab screens (`/players`, `/raids`, `/chat`,
  `/profile`). Detail screens (raid detail, channel/DM chat, profile edit, player detail)
  keep their back-arrow headers untouched — they are sub-screens of the four tabs.
- On desktop (`lg+`) the sidebar replaces BottomNav, so the changelog gets a dedicated
  "Nyheder" item in `DesktopSidebar` (above the user chip) and the in-header hamburger is
  `lg:hidden` to avoid two entry points on raids/chat (whose mobile headers also render
  on desktop via DesktopShell).
- Entries are **content, not UI chrome**: they live in a TypeScript data module
  (Danish-only, like the raid boss list), NOT in `messages/da.json` — putting them in the
  messages payload would ship them on every page and defeat the lazy-load requirement.
  Menu/sheet chrome strings go through next-intl as usual.

## Performance approach

`AppMenu` is a tiny client component (one icon button + menu). The entries module
(`src/lib/changelog/entries.ts`) is loaded via dynamic `import()` the first time the
changelog sheet opens — it is never part of the initial bundle or the RSC payload.

## Files

1. **`src/lib/changelog/entries.ts`** — `export interface ChangelogEntry { date: string; text: string }`
   and `export const CHANGELOG_ENTRIES: ChangelogEntry[]` (newest first). Seed with the
   10 entries listed below. Header comment: every merge to main with user-facing changes
   must prepend an entry (1–2 Danish sentences, no jargon, no PR numbers in the text).
2. **`src/lib/changelog/entries.test.ts`** — TDD: dates are valid `YYYY-MM-DD`, sorted
   newest-first, texts non-empty, ≥10 entries.
3. **`src/components/AppMenu.tsx`** — client component exporting:
   - `ChangelogSheet({ open, onClose })` — backdrop + bottom sheet (`max-w-[480px]`,
     centered, rounded top, matches existing sheet styling e.g. AvatarUploadSheet).
     On first open: `const mod = await import('@/lib/changelog/entries')` → state.
     Renders title ("Nyheder"), close button, scrollable list: date (formatted
     `da-DK`, e.g. "10. juni 2026") + text per entry.
   - `AppMenu()` — hamburger `Menu` icon button (aria-label via i18n), opens a small
     anchored dropdown with one item "Nyheder" (`Newspaper` icon) → opens ChangelogSheet.
     Outside-click + Escape close. 44px touch target, matches header icon styling.
4. **`src/components/DirectoryHeader.tsx`** — `<AppMenu />` before the title (wrapped
   `lg:hidden` not needed — whole mobile directory is already `lg:hidden`; but the header
   itself renders only in the mobile block, so plain `<AppMenu />` is fine).
5. **`src/app/[locale]/raids/page.tsx`** — `<AppMenu />` (wrapped in `lg:hidden`) before
   the `h1` in the fixed header.
6. **`src/components/chat/ChannelListScreen.tsx`** — same, before the `h1`, `lg:hidden`.
7. **`src/app/[locale]/profile/page.tsx`** — same, in the mobile header block.
8. **`src/components/desktop/DesktopSidebar.tsx`** — "Nyheder" button (Newspaper icon,
   same row styling as nav items, muted) directly above the user chip; opens
   `ChangelogSheet`. DesktopSidebar is already a client component.
9. **`messages/da.json` + `messages/en.json`** — new `AppMenu` namespace:
   `menuLabel` ("Menu"), `changelog` ("Nyheder"/"News"), `changelogTitle` ("Nyheder"/"News"),
   `close` ("Luk"/"Close"), `empty` ("Ingen nyheder endnu."/"No news yet.").
10. **Skeletons** — `players/loading.tsx`, `profile/loading.tsx` (and raids loading if it
    exists): add a muted hamburger placeholder in the header so there's no pop-in.
11. **`e2e/changelog.spec.ts`** — env-gated login spec (mirror `profile-edit.spec.ts`):
    open `/players`, click the hamburger, click "Nyheder", assert the sheet shows the
    title and ≥1 entry; close it again.
12. **`CLAUDE.md`** — add the process rule (every user-facing merge to main prepends an
    entry to `src/lib/changelog/entries.ts`) + decisions-log entry.

## Seed entries (newest first)

| date | text (da) |
|------|-----------|
| 2026-06-10 | Gym-navne foreslås nu automatisk, når du opretter et raid. Forslagene kommer fra vores fælles gym-liste, som vokser, hver gang nogen poster et raid med et nyt gym. |
| 2026-06-10 | Appen føles hurtigere: Skift mellem faner giver nu øjeblikkelig feedback, og flere skærme viser en skitse, mens indholdet hentes. |
| 2026-06-09 | Raid-oversigten viser nu altid friske oplysninger, når du går tilbage fra et raid — fx gennemførte raids og ulæste beskeder. |
| 2026-06-09 | Tilbage-pilen på et raid virker nu også, når du har åbnet raidet fra en notifikation. |
| 2026-06-09 | Du får nu en notifikation, når en ny spiller melder sig til et raid, du deltager i. |
| 2026-06-09 | Raid-chatten har fået notifikationer og ulæst-tællere — du kan se nye beskeder på Raids-fanen og på hvert raid-kort. |
| 2026-06-08 | Rettet: Notifikationer om nye beskeder kunne udeblive på Android, når appen lige var lagt i baggrunden. |
| 2026-06-08 | Log ud-knappen er flyttet til Rediger profil-siden, sammen med de andre konto-handlinger. |
| 2026-06-08 | Raids, Chat og Profil har nu et rigtigt desktop-layout med sidemenu, ligesom spilleroversigten. |
| 2026-06-08 | Rettet: Appen kunne vise "Noget gik galt", efter en ny version var udgivet — den henter nu altid den nyeste version. |

## Out of scope

- "New since last visit" indicator dot on the hamburger (possible follow-up).
- Changelog entries in English (app is Danish-first, no language switcher).
- A CI check that enforces the process rule.

## Verification

- `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build` all green.
- Playwright MCP: open the app, verify hamburger on all four tabs, open/close the
  changelog, check desktop sidebar entry at ≥1024px.
- New e2e spec passes locally (env-gated).
