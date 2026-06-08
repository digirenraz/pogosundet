'use client';

import { DesktopSidebar, type SidebarUser } from './DesktopSidebar';

interface DesktopShellProps {
  me?: SidebarUser;
  children: React.ReactNode;
}

// Responsive desktop frame for pages whose content must render ONCE (realtime
// components can't be duplicated into separate mobile/desktop blocks without
// re-subscribing the same channel — cf. the players usePresence fix).
//
// Below lg: a transparent pass-through — `children` (the existing mobile page,
// fixed chrome and all) renders pixel-identical, no sidebar.
//
// At lg+: a flex row with the DesktopSidebar aside + a content area carrying
// `transform: translateZ(0)`. A transformed element becomes the containing block
// for its `position: fixed` descendants, so the page's existing fixed chrome
// (headers, chat composer/panels, BottomNav) is scoped to this area beside the
// sidebar instead of overlapping it — no edits to the page/realtime components.
// (BottomNav is separately `lg:hidden`, since the sidebar replaces it.)
export function DesktopShell({ me, children }: DesktopShellProps) {
  return (
    <div className="lg:flex lg:h-screen lg:overflow-hidden bg-background">
      <aside className="hidden lg:block w-[244px] flex-shrink-0">
        <DesktopSidebar me={me} />
      </aside>
      <div className="lg:flex-1 lg:min-w-0 lg:h-screen lg:overflow-y-auto lg:relative lg:[transform:translateZ(0)]">
        {children}
      </div>
    </div>
  );
}
