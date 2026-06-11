import { createClient } from '@/lib/supabase/client';
import type { RaidInput } from './validation';

export interface Raid extends RaidInput {
  id: string;
  user_id: string;
  created_at: string;
  completed_at: string | null;
}

// Insert a new raid row. Returns { data, error } mirroring Supabase conventions.
export async function createRaid(input: RaidInput & { user_id: string }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('raids')
    .insert(input)
    .select()
    .single();
  return { data: data as Raid | null, error };
}

// Join a raid by inserting into raid_attendees.
export async function joinRaid(raidId: string, userId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from('raid_attendees')
    .insert({ raid_id: raidId, user_id: userId });
  return { error };
}

// Leave a raid by removing from raid_attendees.
export async function leaveRaid(raidId: string, userId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from('raid_attendees')
    .delete()
    .eq('raid_id', raidId)
    .eq('user_id', userId);
  return { error };
}

// The user's most recently used gym names, newest first, for the raid form's
// "Dine seneste gyms" suggestions. Fetches a small window of recent raids and
// dedupes case-insensitively in JS (a raid can repeat the same gym), keeping
// the first (= newest) casing. Returns [] on any error — the suggestion group
// simply doesn't render.
export async function fetchRecentGymNames(
  userId: string,
  limit = 3
): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('raids')
    .select('gym_name')
    .eq('user_id', userId)
    .not('gym_name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(25);
  if (error || !data) return [];

  const seen = new Set<string>();
  const names: string[] = [];
  for (const row of data) {
    const name = row.gym_name as string | null;
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= limit) break;
  }
  return names;
}

// Mark a raid completed (or undo). Sets completed_at to now() when completing,
// or null to undo so a mis-tap is recoverable. RLS enforces that only the
// poster can update their own raid.
export async function toggleRaidCompleted(raidId: string, completed: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from('raids')
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq('id', raidId);
  return { error };
}

// Update how many extra people a user is bringing to the raid.
export async function updateAttendeeExtra(
  raidId: string,
  userId: string,
  extraCount: number
) {
  const supabase = createClient();
  const { error } = await supabase
    .from('raid_attendees')
    .update({ extra_count: extraCount })
    .eq('raid_id', raidId)
    .eq('user_id', userId);
  return { error };
}
