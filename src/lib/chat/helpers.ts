// Client-side helpers for community chat. Uses the browser Supabase client —
// never import this in Server Components.
import { createClient } from '@/lib/supabase/client';
import type { ChannelId } from './channels';

export type { ChannelReactionRow } from './reactions-helpers';

// Raw DB row from a Realtime INSERT event — no embedded profile join.
export interface ChannelMessageRow {
  id: string;
  channel: ChannelId;
  user_id: string;
  body: string;
  created_at: string;
  reply_to_id?: string | null;
}

// Insert a message into channel_messages. The realtime subscription
// in use-channel-realtime.ts will surface the row to all clients.
// Pass replyToId to thread the new message under an existing one.
export async function sendMessage(
  channel: ChannelId,
  userId: string,
  body: string,
  replyToId: string | null = null
): Promise<{ error: unknown }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('channel_messages')
    .insert({ channel, user_id: userId, body, reply_to_id: replyToId });
  return { error };
}
