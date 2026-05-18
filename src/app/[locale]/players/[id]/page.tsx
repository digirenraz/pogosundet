import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllProfiles } from '@/lib/profile/server-helpers';
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

  const { data: profiles } = await getAllProfiles();
  const startIndex = profiles.findIndex((p) => p.id === id);
  if (startIndex === -1) notFound();

  return (
    <PlayerDetailDeckWithPresence
      profiles={profiles}
      startIndex={startIndex}
      currentUserId={userId}
    />
  );
}
