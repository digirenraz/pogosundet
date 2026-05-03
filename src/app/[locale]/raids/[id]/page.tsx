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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Ensure the user has a profile set up
  const { data: ownProfile } = await supabase
    .from('profiles')
    .select('trainer_name')
    .eq('user_id', user.id)
    .single();

  if (!ownProfile) redirect('/profile/setup');

  const raid = await getRaidById(id);
  if (!raid) notFound();

  return (
    <RaidDetail
      raid={raid}
      currentUserId={user.id}
      currentUserName={ownProfile.trainer_name ?? ''}
    />
  );
}
