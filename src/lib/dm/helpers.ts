// Client-side helpers for direct messages. Uses the browser Supabase client —
// never import this in Server Components.
import { createClient } from '@/lib/supabase/client';

// Raw DB row from a Realtime INSERT event on direct_messages — no embedded join.
export interface DirectMessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  reply_to_id: string | null;
  created_at: string;
}

// Insert a DM. The realtime subscription in use-dm-realtime.ts surfaces the row
// on the recipient's side; the sender already has an optimistic placeholder.
export async function sendDM(
  senderId: string,
  recipientId: string,
  body: string,
  replyToId: string | null = null
): Promise<{ error: unknown }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('direct_messages')
    .insert({
      sender_id: senderId,
      recipient_id: recipientId,
      body,
      reply_to_id: replyToId,
    });
  return { error };
}
