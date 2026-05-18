import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getRaidById } from '@/lib/raids/server-helpers';
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
  const [{ data: ownProfile }, raid] = await Promise.all([
    supabase.from('profiles').select('trainer_name').eq('user_id', userId).single(),
    getRaidById(id),
  ]);

  if (!raid) notFound();

  return (
    <RaidDetail
      raid={raid}
      currentUserId={userId}
      currentUserName={ownProfile?.trainer_name ?? ''}
    />
  );
}
