import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllProfiles } from '@/lib/profile/server-helpers';
import { CHANNELS } from '@/lib/chat/channels';
import { getLatestMessageForChannel } from '@/lib/chat/server-helpers';
import { ChannelListScreen, type ChannelListEntry } from '@/components/chat/ChannelListScreen';
import { BottomNav } from '@/components/BottomNav';
import type { OnlineStripProfile } from '@/components/chat/OnlineStrip';
import type { Team } from '@/lib/profile/validation';

export const preferredRegion = 'dub1';

// /chat — channel list. Server Component.
export default async function ChatPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect('/login');

  // Parallel fetches: latest message per channel + all profiles (cached 60s).
  const [profilesResult, ...latestPerChannel] = await Promise.all([
    getAllProfiles(),
    ...CHANNELS.map((c) => getLatestMessageForChannel(c.id)),
  ]);

  const profiles: OnlineStripProfile[] = profilesResult.data.map((p) => ({
    user_id: p.user_id,
    trainer_name: p.trainer_name,
    avatar_url: p.avatar_url ?? null,
    team: (p.team as Team | undefined) ?? null,
    level: p.level ?? null,
  }));

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

  return (
    <>
      <ChannelListScreen
        entries={entries}
        profiles={profiles}
        totalMembers={profiles.length}
        currentUserId={userId}
      />
      <BottomNav />
    </>
  );
}
