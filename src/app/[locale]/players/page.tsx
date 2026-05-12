import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllProfiles } from '@/lib/profile/server-helpers';
import { DirectoryHeader } from '@/components/DirectoryHeader';
import { PlayerDirectory } from '@/components/PlayerDirectory';
import { BottomNav } from '@/components/BottomNav';

// Player Directory — the main authenticated screen.
// Fetches all profiles server-side and passes them to the client component for search/display.
export default async function PlayersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch the user's own profile (for the setup-guard redirect) and the full
  // directory in parallel — both are independent once we have user.id.
  const [{ data: ownProfile }, { data: profiles }] = await Promise.all([
    supabase.from('profiles').select('id').eq('user_id', user.id).single(),
    getAllProfiles(),
  ]);

  if (!ownProfile) redirect('/profile/setup');

  return (
    <div className="min-h-screen bg-background">
      <DirectoryHeader />
      {/* Content padded for fixed header (60px) and fixed bottom nav (64px) */}
      <main className="pt-[76px] pb-[80px] px-4 flex flex-col gap-4">
        <PlayerDirectory profiles={profiles} currentUserId={user.id} />
      </main>
      <BottomNav />
    </div>
  );
}
