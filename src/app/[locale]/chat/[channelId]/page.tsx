import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllProfiles } from '@/lib/profile/server-helpers';
import { getChannelById } from '@/lib/chat/channels';
import { getMemberCount, getMessagesForChannel } from '@/lib/chat/server-helpers';
import { markChannelRead } from '@/lib/chat/read-helpers';
import { ChannelScreen } from '@/components/chat/ChannelScreen';
import type { OnlineStripProfile } from '@/components/chat/OnlineStrip';
import type { Team } from '@/lib/profile/validation';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import type { SidebarUser } from '@/components/desktop/DesktopSidebar';

export const preferredRegion = 'dub1';

interface PageProps {
  params: Promise<{ channelId: string }>;
}

// /chat/[channelId] — single channel view. Server Component.
export default async function ChannelPage({ params }: PageProps) {
  const { channelId } = await params;
  const channel = getChannelById(channelId);
  if (!channel) notFound();

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect('/login');

  // Parallel fetches once we have a valid channel + user.
  // markChannelRead bumps last_read_at = NOW() so this channel renders with 0 unread.
  const [messages, profilesResult, memberCount, meResult] = await Promise.all([
    getMessagesForChannel(channel.id, 100),
    getAllProfiles(),
    getMemberCount(),
    supabase
      .from('profiles')
      .select('trainer_name')
      .eq('user_id', userId)
      .single(),
    markChannelRead(userId, channel.id),
  ]);

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
      <ChannelScreen
        channel={channel}
        initialMessages={messages}
        profiles={profiles}
        memberCount={memberCount}
        currentUserId={userId}
        currentUserName={currentUserName}
      />
    </DesktopShell>
  );
}
