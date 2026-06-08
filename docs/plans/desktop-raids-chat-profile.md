# Desktop layouts for Raids, Chat, Profile

Follow-up to the desktop player overview (#90). Add the desktop sidebar shell +
desktop-appropriate layouts for the other three nav destinations, so the desktop
app is consistent (sidebar across all four pages). Responsive on the same routes
(`lg+` = desktop; below = existing mobile, untouched).

## Constraints discovered
- **Realtime double-subscription**: rendering a realtime component twice (mobile
  block + desktop block) re-subscribes the same channel → collision (same class
  of bug as the players `usePresence` fix). So Raids (`useRaidsRealtime`) and Chat
  (unread/message realtime) must render **once**.
- **Fixed chrome**: chat/raids mobile screens use `fixed top-0 left-0 right-0`
  headers / panels assuming full-viewport width — they'd overlap a sidebar.

## Approach
**`DesktopShell`** (new client component) — wraps a page's existing content once:
at `lg+` it's `flex h-screen` with a `DesktopSidebar` aside + a content area that
carries `transform: translateZ(0)`. The transform makes it the **containing block
for `position: fixed` descendants**, so the page's existing fixed chrome is scoped
beside the sidebar — no edits to the realtime components, content rendered once.
Below `lg` the shell is a plain pass-through (mobile pixel-identical).

- **Raids** (`raids/page.tsx`): fetch `me`, wrap the existing content in
  `DesktopShell`. `BottomNav` gets `lg:hidden` (the sidebar replaces it).
- **Chat** (`chat/page.tsx`, `chat/[channelId]`, `chat/dm/[partnerId]`): derive
  `me` from the already-fetched profiles, wrap each in `DesktopShell`. Navigates
  list↔thread as today, but with the persistent sidebar (shell-frame, not 2-pane).
- **Profile** (`profile/page.tsx`): no realtime → safe to render two layouts. Keep
  the mobile layout under `lg:hidden`; add a bespoke `hidden lg:flex` desktop block
  = `DesktopSidebar` + new **`DesktopProfile`** (2-column: identity/bio card +
  friend-code QR card, mirroring the design mock, on real data, reusing `Avatar`,
  `TeamChip`, `LevelPill`, `FriendCodeQR`).

**Shared bits**: `BottomNav` → `lg:hidden`. `DesktopSidebar` nav → `h-full` (fills
the shell aside); relax its `me` prop to a minimal shape so chat's profile rows fit.

## Verification
- `tsc`, `eslint`, `npm run build`, unit tests.
- ⚠️ Authenticated screens — can't drive a logged-in desktop session here. Build
  is the type/lint gate; **needs a preview/prod visual check at ≥1024px**,
  especially the chat transform-containing-block (header/scroll/composer placement).
