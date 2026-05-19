// Slice 12: server-side helpers for the unread-count system.
// Uses the server Supabase client. Do NOT import from client components.
import { createClient } from '@/lib/supabase/server';
import { CHANNELS, type ChannelId } from './channels';

export type UnreadCounts = Record<ChannelId, number>;

// Upsert this user's last_read_at = NOW() for one channel.
// Called by /chat/[channelId] on every visit so opening a channel always
// clears its badge.
export async function markChannelRead(userId: string, channel: ChannelId): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('channel_reads')
    .upsert(
      { user_id: userId, channel, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,channel' }
    );
}

// Seed missing channel_reads rows with NOW() — DO NOTHING on conflict so
// established users keep their real last_read_at. Called from /chat on every
// visit; for first-time users it turns "47 unread" into 0 unread instead of
// showing the full channel history as unread.
export async function markChannelsSeen(userId: string, channels: readonly ChannelId[]): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  await supabase
    .from('channel_reads')
    .upsert(
      channels.map((c) => ({ user_id: userId, channel: c, last_read_at: now })),
      { onConflict: 'user_id,channel', ignoreDuplicates: true }
    );
}

// Per-channel unread count for this user. Treats a missing channel_reads row
// as last_read_at = '-infinity' (everything unread).
export async function getUnreadCountsForUser(userId: string): Promise<UnreadCounts> {
  const supabase = await createClient();

  const { data: reads } = await supabase
    .from('channel_reads')
    .select('channel, last_read_at')
    .eq('user_id', userId);

  const readsByChannel = new Map<ChannelId, string>();
  for (const r of (reads ?? []) as Array<{ channel: ChannelId; last_read_at: string }>) {
    readsByChannel.set(r.channel, r.last_read_at);
  }

  const counts = await Promise.all(
    CHANNELS.map(async (c) => {
      let query = supabase
        .from('channel_messages')
        .select('*', { count: 'exact', head: true })
        .eq('channel', c.id)
        .neq('user_id', userId);
      const since = readsByChannel.get(c.id);
      if (since) query = query.gt('created_at', since);
      const { count } = await query;
      return [c.id, count ?? 0] as const;
    })
  );

  return Object.fromEntries(counts) as UnreadCounts;
}
