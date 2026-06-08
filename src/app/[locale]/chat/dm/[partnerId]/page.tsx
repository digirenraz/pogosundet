import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllProfiles } from '@/lib/profile/server-helpers';
import {
  getDMPartnerProfile,
  getMessagesForConversation,
  markDMRead,
} from '@/lib/dm/server-helpers';
import { DMScreen } from '@/components/chat/DMScreen';
import type { OnlineStripProfile } from '@/components/chat/OnlineStrip';
import type { Team } from '@/lib/profile/validation';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import type { SidebarUser } from '@/components/desktop/DesktopSidebar';

export const preferredRegion = 'dub1';

interface PageProps {
  params: Promise<{ partnerId: string }>;
}

// /chat/dm/[partnerId] — single DM conversation view. Server Component.
export default async function DMPage({ params }: PageProps) {
  const { partnerId } = await params;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect('/login');

  // Can't DM yourself.
  if (partnerId === userId) notFound();

  // Parallel fetches once we have a valid user + partner.
  // markDMRead bumps last_read_at = NOW() so this conversation renders with 0 unread.
  const [partner, messages, profilesResult, meResult] = await Promise.all([
    getDMPartnerProfile(partnerId),
    getMessagesForConversation(userId, partnerId, 100),
    getAllProfiles(),
    supabase
      .from('profiles')
      .select('trainer_name')
      .eq('user_id', userId)
      .single(),
    markDMRead(userId, partnerId),
  ]);

  // Unknown partner → 404. Also catches the case where a user types a random
  // uuid into the URL bar.
  if (!partner) notFound();

  const currentUserName =
    (meResult.data as { trainer_name: string } | null)?.trainer_name ?? '';

  const profiles: OnlineStripProfile[] = profilesResult.data.map((p) => ({
    user_id: p.user_id,
    trainer_name: p.trainer_name,
    avatar_url: p.avatar_url ?? null,
    team: (p.team as Team | undefined) ?? null,
    level: p.level ?? null,
  }));

  const meRow = profilesResult.data.find((p) => p.user_id === userId);
  const me: SidebarUser | undefined = meRow
    ? {
        trainer_name: meRow.trainer_name,
        first_name: meRow.first_name ?? null,
        avatar_url: meRow.avatar_url ?? null,
        team: (meRow.team as Team | undefined) ?? null,
        level: meRow.level ?? null,
      }
    : undefined;

  return (
    <DesktopShell me={me}>
      <DMScreen
        partner={partner}
        initialMessages={messages}
        profiles={profiles}
        currentUserId={userId}
        currentUserName={currentUserName}
      />
    </DesktopShell>
  );
}
