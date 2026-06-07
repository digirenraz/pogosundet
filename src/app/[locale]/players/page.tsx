import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllProfiles } from '@/lib/profile/server-helpers';
import { DirectoryHeader } from '@/components/DirectoryHeader';
import { PlayerDirectory } from '@/components/PlayerDirectory';
import { BottomNav } from '@/components/BottomNav';
import { DesktopSidebar } from '@/components/desktop/DesktopSidebar';
import { DesktopPlayers } from '@/components/desktop/DesktopPlayers';

// Player Directory — the main authenticated screen.
// Fetches all profiles server-side and passes them to the client component for search/display.
export default async function PlayersPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) redirect('/login');

  // getAllProfiles is cached (60s TTL) for performance.
  // last_seen_at is fetched fresh every render so the badge is never stale.
  const [{ data: profiles }, lastSeenResult] = await Promise.all([
    getAllProfiles(),
    supabase.from('profiles').select('user_id, last_seen_at'),
  ]);
  const lastSeenMap = Object.fromEntries(
    (lastSeenResult.data ?? []).map((p) => [p.user_id, p.last_seen_at])
  );
  const freshProfiles = profiles.map((p) => ({
    ...p,
    last_seen_at: (lastSeenMap[p.user_id] as string | null) ?? p.last_seen_at ?? null,
  }));

  const me = freshProfiles.find((p) => p.user_id === userId);

  return (
    <>
      {/* Mobile / tablet (<1024px): the existing single-column directory + bottom nav. */}
      <div className="min-h-screen bg-background lg:hidden">
        <DirectoryHeader />
        {/* Content padded for fixed header (60px) and fixed bottom nav (64px) */}
        <main className="pt-[76px] pb-[80px] px-4 flex flex-col gap-4">
          <PlayerDirectory profiles={freshProfiles} currentUserId={userId} />
        </main>
        <BottomNav />
      </div>

      {/* Desktop (≥1024px): sidebar shell + the QR scan-session. */}
      <div className="hidden lg:flex h-screen overflow-hidden bg-background">
        <DesktopSidebar me={me} />
        <div className="flex-1 min-w-0 h-screen overflow-hidden">
          <DesktopPlayers profiles={freshProfiles} currentUserId={userId} />
        </div>
      </div>
    </>
  );
}
