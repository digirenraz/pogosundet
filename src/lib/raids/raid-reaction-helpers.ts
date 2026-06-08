// Client-side helpers for raid-level reactions ("TfR!", "I got a shiny!",
// "I got a hundo!"). Reactions are on the raid itself, not on a chat message.
// Uses the browser Supabase client — never import this in Server Components.
import { createClient } from '@/lib/supabase/client';

// Stable reaction codes stored in the DB. Human labels live in i18n.
export const REACTION_CODES = ['tfr', 'shiny', 'hundo'] as const;
export type ReactionCode = (typeof REACTION_CODES)[number];

// Raw row from a Realtime INSERT/DELETE event on raid_reactions.
export interface RaidReactionRow {
  raid_id: string;
  user_id: string;
  reaction: string;
}

// user_ids per reaction code — used both for counts and "did I react".
export interface GroupedRaidReactions {
  tfr: string[];
  shiny: string[];
  hundo: string[];
}

// Group a flat list of reaction rows into a code → user_id[] map. Unknown
// codes are ignored. user_ids are de-duplicated defensively.
export function groupRaidReactions(
  rows: { user_id: string; reaction: string }[]
): GroupedRaidReactions {
  const result: GroupedRaidReactions = { tfr: [], shiny: [], hundo: [] };
  for (const row of rows) {
    const code = row.reaction as ReactionCode;
    if (!REACTION_CODES.includes(code)) continue;
    if (!result[code].includes(row.user_id)) result[code].push(row.user_id);
  }
  return result;
}

// Resolve a reactor's display name for the "who reacted" breakdown. The current
// user is shown as `youLabel` ("Dig"); a user_id with no known profile falls
// back to `unknownLabel`. Names are resolved from a user_id → trainer_name map
// (built from the cached profile directory) because raid_reactions.user_id FKs
// auth.users, not profiles, so the name can't be embedded in the query.
export function reactorName(
  userId: string,
  currentUserId: string,
  profileNames: Record<string, string>,
  youLabel: string,
  unknownLabel: string
): string {
  if (userId === currentUserId) return youLabel;
  return profileNames[userId] ?? unknownLabel;
}

// Toggle a single reaction on a raid. The caller passes whether the reaction is
// currently on (so we know which direction to go); RLS enforces owner of the
// row. Returns whether the net effect was an "add" or a "remove".
export async function toggleRaidReaction(
  raidId: string,
  userId: string,
  reaction: ReactionCode,
  isCurrentlyOn: boolean
): Promise<{ added: boolean; error: unknown }> {
  const supabase = createClient();
  if (isCurrentlyOn) {
    const { error } = await supabase
      .from('raid_reactions')
      .delete()
      .eq('raid_id', raidId)
      .eq('user_id', userId)
      .eq('reaction', reaction);
    return { added: false, error };
  }
  const { error } = await supabase
    .from('raid_reactions')
    .insert({ raid_id: raidId, user_id: userId, reaction });
  // A PK conflict (23505) means it already existed — treat as already added.
  if (error && (error as { code?: string }).code === '23505') {
    return { added: true, error: null };
  }
  return { added: true, error };
}
