'use client';

import { useMemo } from 'react';
import type { Profile } from '@/lib/profile/helpers';
import type { ScanStatus } from '@/lib/players/scan-status';
import { usePresence } from '@/lib/profile/use-presence';
import { DirectoryHeader } from './DirectoryHeader';
import { PlayerDirectory } from './PlayerDirectory';
import { BottomNav } from './BottomNav';
import { DesktopSidebar } from './desktop/DesktopSidebar';
import { DesktopPlayers } from './desktop/DesktopPlayers';

interface PlayersScreenProps {
  profiles: Profile[];
  currentUserId: string;
  // Persisted desktop scan-session marks (target user_id -> added/skipped),
  // private to the current user. Seeds the scan-session queue and the
  // "Allerede tilføjet" hint on player cards.
  scanStatus: Record<string, ScanStatus>;
}

// Responsive shell for the player directory. Owns the SINGLE `usePresence`
// subscription and passes the online set down to both layouts — the mobile
// directory and the desktop scan-session render simultaneously (CSS toggles
// visibility), so calling `usePresence` inside each would open two Supabase
// channels with the same `players-online` topic and throw a collision error.
export function PlayersScreen({ profiles, currentUserId, scanStatus }: PlayersScreenProps) {
  const onlineUserIds = usePresence(currentUserId);
  const me = profiles.find((p) => p.user_id === currentUserId);

  // Players already marked "added" — drives the subtle card hint. Skipped marks
  // only seed the scan-session queue, so they're excluded here.
  const addedUserIds = useMemo(
    () =>
      new Set(
        Object.entries(scanStatus)
          .filter(([, s]) => s === 'added')
          .map(([userId]) => userId)
      ),
    [scanStatus]
  );

  return (
    <>
      {/* Mobile / tablet (<1024px): the existing single-column directory + bottom nav. */}
      <div className="min-h-screen bg-background lg:hidden">
        <DirectoryHeader />
        {/* Content padded for the branded header (~105px) and fixed bottom nav (64px) */}
        <main className="pt-[116px] pb-[80px] px-4 flex flex-col gap-4">
          <PlayerDirectory
            profiles={profiles}
            currentUserId={currentUserId}
            onlineUserIds={onlineUserIds}
            addedUserIds={addedUserIds}
          />
        </main>
        <BottomNav />
      </div>

      {/* Desktop (≥1024px): sidebar shell + the QR scan-session. */}
      <div className="hidden lg:flex h-screen overflow-hidden bg-background">
        <DesktopSidebar me={me} />
        <div className="flex-1 min-w-0 h-screen overflow-hidden">
          <DesktopPlayers
            profiles={profiles}
            currentUserId={currentUserId}
            onlineUserIds={onlineUserIds}
            initialStatus={scanStatus}
          />
        </div>
      </div>
    </>
  );
}
