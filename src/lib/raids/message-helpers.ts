// Client-side helpers for raid chat messages.
// Uses the browser Supabase client — never import this in Server Components.
import { createClient } from '@/lib/supabase/client';

// Profile blob embedded with each message — matches the richer shape used by
// `MessageGroupView` (Slice 16 brought raid chat to parity with channel chat).
export interface RaidMessageProfile {
  trainer_name: string;
  avatar_url: string | null;
  team: 'mystic' | 'valor' | 'instinct' | null;
  level: number | null;
}

// Raw reaction row embedded under each message via the PostgREST alias
// `reactions:raid_message_reactions(...)`. The client groups these via
// `groupReactions()`.
export interface RaidMessageReactionRow {
  user_id: string;
  emoji: string;
}

export interface RaidMessage {
  id: string;
  raid_id: string;
  user_id: string;
  message: string;
  created_at: string;
  reply_to_id: string | null;
  profiles: RaidMessageProfile | null;
  reactions: RaidMessageReactionRow[];
}

// Raw DB row from a Realtime INSERT event — no embedded profile join, no
// reactions. Reply id is carried so the consumer can render the reply quote
// when the row arrives via realtime.
export interface RaidMessageRow {
  id: string;
  raid_id: string;
  user_id: string;
  message: string;
  created_at: string;
  reply_to_id: string | null;
}

// Insert a chat message into raid_messages. Pass replyToId to thread the new
// message under an existing one.
export async function sendMessage(
  raidId: string,
  userId: string,
  message: string,
  replyToId: string | null = null
): Promise<{ error: unknown }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('raid_messages')
    .insert({ raid_id: raidId, user_id: userId, message, reply_to_id: replyToId });
  return { error };
}

// Fetch all messages for a raid ordered oldest-first, including the poster's
// trainer/profile info and any reaction rows via embedded selects.
export async function getMessagesForRaid(raidId: string): Promise<RaidMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('raid_messages')
    .select(
      '*, profiles(trainer_name, avatar_url, team, level), reactions:raid_message_reactions(user_id, emoji)'
    )
    .eq('raid_id', raidId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []) as unknown as RaidMessage[];
}
