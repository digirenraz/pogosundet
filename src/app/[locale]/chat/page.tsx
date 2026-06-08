import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllProfiles } from '@/lib/profile/server-helpers';
import { CHANNELS } from '@/lib/chat/channels';
import { getLatestMessageForChannel } from '@/lib/chat/server-helpers';
import { getUnreadCountsForUser, markChannelsSeen } from '@/lib/chat/read-helpers';
import { getDMConversations } from '@/lib/dm/server-helpers';
import { ChannelListScreen, type ChannelListEntry } from '@/components/chat/ChannelListScreen';
import type { DMRowEntry } from '@/components/chat/DMRow';
import { BottomNav } from '@/components/BottomNav';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import type { SidebarUser } from '@/components/desktop/DesktopSidebar';
import type { OnlineStripProfile } from '@/components/chat/OnlineStrip';
import type { Team } from '@/lib/profile/validation';

export const preferredRegion = 'dub1';

// /chat — channel list + DM list. Server Component.
export default async function ChatPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect('/login');

  const channelIds = CHANNELS.map((c) => c.id);
  const [initialUnreadCounts, , profilesResult, dmConversations, ...latestPerChannel] =
    await Promise.all([
      getUnreadCountsForUser(userId),
      markChannelsSeen(userId, channelIds),
      getAllProfiles(),
      getDMConversations(userId),
      ...CHANNELS.map((c) => getLatestMessageForChannel(c.id)),
    ]);

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

  const entries: ChannelListEntry[] = CHANNELS.map((channel, i) => {
    const last = latestPerChannel[i];
    return {
      channel,
      lastMessage: last
        ? {
            body: last.body,
            created_at: last.created_at,
            author_name: last.profiles?.trainer_name ?? null,
            author_is_me: last.user_id === userId,
          }
        : null,
    };
  });

  const dmEntries: DMRowEntry[] = dmConversations.map((c) => ({
    partnerId: c.partner_id,
    partner: c.partner,
    lastMessage: c.last_message,
    unread: c.unread_count,
  }));

  return (
    <DesktopShell me={me}>
      <ChannelListScreen
        entries={entries}
        profiles={profiles}
        totalMembers={profiles.length}
        currentUserId={userId}
        initialUnreadCounts={initialUnreadCounts}
        dmEntries={dmEntries}
      />
      <BottomNav />
    </DesktopShell>
  );
}
