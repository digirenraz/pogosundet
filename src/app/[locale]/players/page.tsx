import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllProfiles, redactHiddenFriendCodes } from '@/lib/profile/server-helpers';
import { PlayersScreen } from '@/components/PlayersScreen';

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

  // Withhold hidden friend codes from everyone but their owner (issue #101).
  const visibleProfiles = redactHiddenFriendCodes(freshProfiles, userId);

  // PlayersScreen (client) owns the single presence subscription and renders
  // both the mobile directory and the desktop scan-session responsively.
  return <PlayersScreen profiles={visibleProfiles} currentUserId={userId} />;
}
