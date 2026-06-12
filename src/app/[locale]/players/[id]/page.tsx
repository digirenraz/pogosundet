import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllProfiles, redactHiddenFriendCodes } from '@/lib/profile/server-helpers';
import { PlayerDetailDeckWithPresence } from '@/components/PlayerDetailDeckWithPresence';

export const preferredRegion = 'dub1';

interface PlayerDetailPageProps {
  params: Promise<{ id: string }>;
}

// Player detail — swipable deck of all profiles, starting at the requested id.
// Reuses the cached getAllProfiles() result that powers /players, so opening a
// detail from the directory hits no fresh Supabase round-trip.
export default async function PlayerDetailPage({ params }: PlayerDetailPageProps) {
  const { id } = await params;

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
  const startIndex = visibleProfiles.findIndex((p) => p.id === id);
  if (startIndex === -1) notFound();

  return (
    <PlayerDetailDeckWithPresence
      profiles={visibleProfiles}
      startIndex={startIndex}
      currentUserId={userId}
    />
  );
}
