import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getRaidById } from '@/lib/raids/server-helpers';
import { getAllProfiles } from '@/lib/profile/server-helpers';
import { RaidDetail } from '@/components/RaidDetail';

interface RaidDetailPageProps {
  params: Promise<{ id: string }>;
}

// Server Component — fetches raid + user session, then renders the client detail view.
export default async function RaidDetailPage({ params }: RaidDetailPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) redirect('/login');

  // We still need trainer_name for the chat composer — fetch it in parallel
  // with the raid data. The profile-existence guard is handled by middleware.
  // getAllProfiles (cached) gives us names for every reactor — raid_reactions
  // FKs auth.users, not profiles, so names can't be embedded in the raid query.
  const [{ data: ownProfile }, raid, { data: profiles }] = await Promise.all([
    supabase.from('profiles').select('trainer_name').eq('user_id', userId).single(),
    getRaidById(id),
    getAllProfiles(),
  ]);

  if (!raid) notFound();

  const profileNames = Object.fromEntries(
    profiles.map((p) => [p.user_id, p.trainer_name])
  );

  return (
    <RaidDetail
      raid={raid}
      currentUserId={userId}
      currentUserName={ownProfile?.trainer_name ?? ''}
      profileNames={profileNames}
    />
  );
}
