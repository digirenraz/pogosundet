import { createClient } from '@/lib/supabase/server';
import type { RaidMessage } from './message-helpers';

export interface AttendeeProfile {
  trainer_name: string;
}

export interface RaidAttendeeWithProfile {
  user_id: string;
  extra_count: number;
  profiles: AttendeeProfile | null;
}

// Raw raid-level reaction row embedded under each raid via the PostgREST
// select `raid_reactions(user_id, reaction)`. Grouped client-side for counts.
export interface RaidReactionEmbed {
  user_id: string;
  reaction: string;
}

export interface RaidWithAttendees {
  id: string;
  user_id: string;
  image_url: string | null;
  gym_name: string | null;
  boss_name: string | null;
  starts_at: string | null;
  note: string | null;
  created_at: string;
  completed_at: string | null;
  raid_attendees: RaidAttendeeWithProfile[];
  raid_messages: { id: string }[];
  raid_reactions: RaidReactionEmbed[];
}

// Full raid with all message data — used by the detail screen.
export interface RaidWithDetails extends Omit<RaidWithAttendees, 'raid_messages'> {
  raid_messages: RaidMessage[];
}

// Returns the poster's trainer_name by finding their attendee record.
// The poster is auto-joined at post time, so they appear in raid_attendees.
export function getPosterName(raid: RaidWithAttendees): string | null {
  const poster = raid.raid_attendees.find(a => a.user_id === raid.user_id);
  return poster?.profiles?.trainer_name ?? null;
}

// Shared select string for list queries — includes extra_count, message IDs,
// the completion flag, and raid-level reactions (for the card count summary).
const LIST_SELECT = '*, raid_attendees(user_id, extra_count, profiles(trainer_name)), raid_messages(id), raid_reactions(user_id, reaction)';

// Shared 45-minute threshold helper. A raid is "active" when it's recent AND
// not marked completed — the poster marking it completed forces it into the
// greyed/expired bucket immediately, regardless of age.
function isActive(raid: {
  starts_at: string | null;
  created_at: string;
  completed_at?: string | null;
}): boolean {
  if (raid.completed_at) return false;
  const threshold = new Date(Date.now() - 45 * 60 * 1000);
  const ref = raid.starts_at ?? raid.created_at;
  return new Date(ref) > threshold;
}

// Fetches active raids with their attendees.
// Fetches raids from the last 2 hours, then filters client-side:
// a raid is "active" if COALESCE(starts_at, created_at) is within the last 45 minutes.
// Client-side filter avoids complex PostgREST timestamp syntax.
export async function getActiveRaids() {
  const supabase = await createClient();

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('raids')
    .select(LIST_SELECT)
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };

  const active = (data ?? []).filter(isActive);

  return { data: active as RaidWithAttendees[], error: null };
}

// Like getActiveRaids but also returns ended raids (kept for 14 days so the
// community can still react "TfR!" after the raid), split into active and
// expired buckets. Used by the raids list page.
export async function getRecentRaids(): Promise<{
  active: RaidWithAttendees[];
  expired: RaidWithAttendees[];
  error: unknown;
}> {
  const supabase = await createClient();

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('raids')
    .select(LIST_SELECT)
    .gte('created_at', fourteenDaysAgo)
    .order('created_at', { ascending: false });

  if (error) return { active: [], expired: [], error };

  const all = (data ?? []) as RaidWithAttendees[];
  const active = all.filter(isActive);
  const expired = all.filter(r => !isActive(r));

  return { active, expired, error: null };
}

// Fetches a single raid with full message data for the detail screen.
// Embeds the richer profile shape (trainer_name + avatar/team/level) and the
// reactions table — aliased as `reactions` — so the chat UI can render with
// the same data shape as community chat.
export async function getRaidById(id: string): Promise<RaidWithDetails | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('raids')
    .select(
      '*, raid_attendees(user_id, extra_count, profiles(trainer_name)), raid_messages(id, raid_id, user_id, message, created_at, reply_to_id, profiles(trainer_name, avatar_url, team, level), reactions:raid_message_reactions(user_id, emoji)), raid_reactions(user_id, reaction)'
    )
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return data as unknown as RaidWithDetails;
}
