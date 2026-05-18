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

export interface ChannelMessage {
  id: string;
  channel: ChannelId;
  user_id: string;
  body: string;
  created_at: string;
  profiles: ChannelMessageProfile | null;
}

// Latest message in a channel — used for the channel-list "last message" preview.
export async function getLatestMessageForChannel(
  channelId: ChannelId
): Promise<ChannelMessage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('channel_messages')
    .select('*, profiles(trainer_name, avatar_url, team, level)')
    .eq('channel', channelId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as ChannelMessage;
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
    .select('*, profiles(trainer_name, avatar_url, team, level)')
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
