// Client-side helpers for chat emoji reactions. Uses the browser Supabase
// client — never import this in Server Components.
import { createClient } from '@/lib/supabase/client';

// Raw row from a Realtime INSERT/DELETE event on channel_message_reactions.
export interface ChannelReactionRow {
  message_id: string;
  user_id: string;
  emoji: string;
}

// Toggle a single emoji reaction on a message. Optimistic strategy: attempt
// INSERT first; if it fails with a PK conflict (23505) the row already exists,
// so flip to DELETE. Returns whether the net effect was an "add" or a "remove".
export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ added: boolean; error: unknown }> {
  const supabase = createClient();
  const insert = await supabase
    .from('channel_message_reactions')
    .insert({ message_id: messageId, user_id: userId, emoji });
  if (!insert.error) {
    return { added: true, error: null };
  }
  // PostgreSQL unique-violation. PostgREST surfaces the code on the error.
  const code = (insert.error as { code?: string }).code;
  if (code === '23505') {
    const del = await supabase
      .from('channel_message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji);
    return { added: false, error: del.error };
  }
  return { added: false, error: insert.error };
}

// Group a flat list of reaction rows into an emoji → user_id[] map.
// Stable order: first-seen emoji is first key in the returned object;
// first-seen user is first in each array. Empty arrays are filtered out.
export function groupReactions(
  rows: ChannelReactionRow[]
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const row of rows) {
    if (!result[row.emoji]) result[row.emoji] = [];
    if (!result[row.emoji].includes(row.user_id)) {
      result[row.emoji].push(row.user_id);
    }
  }
  // Filter out empty arrays defensively (shouldn't happen with above logic).
  for (const key of Object.keys(result)) {
    if (result[key].length === 0) delete result[key];
  }
  return result;
}
