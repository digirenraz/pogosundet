import { createClient } from '@/lib/supabase/client';
import type { RaidInput } from './validation';

export interface Raid extends RaidInput {
  id: string;
  user_id: string;
  created_at: string;
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
