// Server-only helpers for community chat channels.
// Uses the server Supabase client (cookies). Do NOT import from client components.
// Intentionally NOT wrapped in unstable_cache — chat must always reflect the
// latest state, and Realtime drives client updates separately.
import { createClient } from '@/lib/supabase/server';
import type { ChannelId } from './channels';

export interface ChannelMessageProfile {
  trainer_name: string;
  avatar_url: string | null;
  team: 'mystic' | 'valor' | 'instinct' | null;
  level: number | null;
}

export interface ChannelMessageReactionRow {
  emoji: string;
  user_id: string;
}

export interface ChannelMessage {
  id: string;
  channel: ChannelId;
  user_id: string;
  body: string;
  created_at: string;
  reply_to_id: string | null;
  profiles: ChannelMessageProfile | null;
  // Embedded via FK from channel_message_reactions.message_id. The list is
  // grouped/keyed on the client by groupReactions().
  reactions: ChannelMessageReactionRow[];
}

// Latest message in a channel — used for the channel-list "last message" preview.
export async function getLatestMessageForChannel(
  channelId: ChannelId
): Promise<ChannelMessage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('channel_messages')
    .select(
      'id, channel, user_id, body, created_at, reply_to_id, profiles(trainer_name, avatar_url, team, level)'
    )
    .eq('channel', channelId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  // Preview rows don't need reactions — synthesise an empty list to satisfy the type.
  return { ...(data as unknown as Omit<ChannelMessage, 'reactions'>), reactions: [] };
}

// Latest N messages for a channel, oldest-first so the UI can render in order.
// Default limit 100 — infinite scroll-back is a follow-up.
export async function getMessagesForChannel(
  channelId: ChannelId,
  limit = 100
): Promise<ChannelMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('channel_messages')
    .select(
      'id, channel, user_id, body, created_at, reply_to_id, profiles(trainer_name, avatar_url, team, level), reactions:channel_message_reactions(emoji, user_id)'
    )
    .eq('channel', channelId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown as ChannelMessage[]).slice().reverse();
}

// Count of profiles — used as the "X medlemmer" badge on the channel screen.
// Every registered profile is a member of every channel for v1.
export async function getMemberCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  if (error || count == null) return 0;
  return count;
}
