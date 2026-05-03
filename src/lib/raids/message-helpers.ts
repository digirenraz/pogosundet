// Client-side helpers for raid chat messages.
// Uses the browser Supabase client — never import this in Server Components.
import { createClient } from '@/lib/supabase/client';

export interface RaidMessage {
  id: string;
  raid_id: string;
  user_id: string;
  message: string;
  created_at: string;
  profiles: { trainer_name: string } | null;
}

// Insert a chat message into raid_messages.
export async function sendMessage(
  raidId: string,
  userId: string,
  message: string
): Promise<{ error: unknown }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('raid_messages')
    .insert({ raid_id: raidId, user_id: userId, message });
  return { error };
}

// Fetch all messages for a raid ordered oldest-first,
// including the poster's trainer_name via embedded profiles query.
export async function getMessagesForRaid(raidId: string): Promise<RaidMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('raid_messages')
    .select('*, profiles(trainer_name)')
    .eq('raid_id', raidId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []) as RaidMessage[];
}
