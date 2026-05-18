// Client-side helpers for community chat. Uses the browser Supabase client —
// never import this in Server Components.
import { createClient } from '@/lib/supabase/client';
import type { ChannelId } from './channels';

// Raw DB row from a Realtime INSERT event — no embedded profile join.
export interface ChannelMessageRow {
  id: string;
  channel: ChannelId;
  user_id: string;
  body: string;
  created_at: string;
}

// Insert a message into channel_messages. The realtime subscription
// in use-channel-realtime.ts will surface the row to all clients.
export async function sendMessage(
  channel: ChannelId,
  userId: string,
  body: string
): Promise<{ error: unknown }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('channel_messages')
    .insert({ channel, user_id: userId, body });
  return { error };
}
