// Client-side helpers for DM emoji reactions. Mirrors
// src/lib/chat/reactions-helpers.ts but operates on `direct_message_reactions`.
// Never import this in Server Components.
import { createClient } from '@/lib/supabase/client';

// Raw row from a Realtime INSERT/DELETE event on direct_message_reactions.
export interface DMReactionRow {
  message_id: string;
  user_id: string;
  emoji: string;
}

// Toggle a single emoji reaction on a DM. Try-INSERT-then-DELETE pattern:
// the PK (message_id, user_id, emoji) makes the "add or remove" decision
// deterministic without a prior SELECT round-trip.
export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ added: boolean; error: unknown }> {
  const supabase = createClient();
  const insert = await supabase
    .from('direct_message_reactions')
    .insert({ message_id: messageId, user_id: userId, emoji });
  if (!insert.error) {
    return { added: true, error: null };
  }
  const code = (insert.error as { code?: string }).code;
  if (code === '23505') {
    const del = await supabase
      .from('direct_message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji);
    return { added: false, error: del.error };
  }
  return { added: false, error: insert.error };
}

// Group a flat list of reaction rows into an emoji → user_id[] map.
// Stable order: first-seen emoji is first key; first-seen user first in array.
export function groupReactions(
  rows: DMReactionRow[]
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const row of rows) {
    if (!result[row.emoji]) result[row.emoji] = [];
    if (!result[row.emoji].includes(row.user_id)) {
      result[row.emoji].push(row.user_id);
    }
  }
  for (const key of Object.keys(result)) {
    if (result[key].length === 0) delete result[key];
  }
  return result;
}
