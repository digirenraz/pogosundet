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
  raid_messages: { id: string; user_id: string; created_at: string }[];
  raid_reactions: RaidReactionEmbed[];
  // Unread raid-chat message count for the current viewer — computed in
  // `getRecentRaids` from the embedded `raid_messages` + a batch `raid_reads`
  // query (no per-raid round trips). Only set on list results; `undefined`
  // elsewhere (e.g. `getRaidById`, which marks the raid read instead).
  unread_count?: number;
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

// Shared select string for list queries — includes extra_count, the
// completion flag, raid-level reactions (for the card count summary), and
// enough per-message data (author + timestamp) to compute unread counts in
// `getRecentRaids` purely in JS, without a per-raid count query.
const LIST_SELECT = '*, raid_attendees(user_id, extra_count, profiles(trainer_name)), raid_messages(id, user_id, created_at), raid_reactions(user_id, reaction)';

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
//
// Also computes each raid's `unread_count` (issue #104) — scoped to raids the
// viewer has JOINED, mirroring the push-notification recipient set ("notify
// the other attendees"): a raid you've never joined would otherwise show its
// full message count as "unread" on first sight, which isn't useful. Computed
// in JS from the already-embedded `raid_messages` (author + timestamp) plus
// one batch `raid_reads` query — avoids the N per-raid count queries the DM
// unread list takes (this scales worse: every raid card renders at once).
export async function getRecentRaids(userId: string): Promise<{
  active: RaidWithAttendees[];
  expired: RaidWithAttendees[];
  error: unknown;
}> {
  const supabase = await createClient();

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data, error }, { data: readRows }] = await Promise.all([
    supabase
      .from('raids')
      .select(LIST_SELECT)
      .gte('created_at', fourteenDaysAgo)
      .order('created_at', { ascending: false }),
    supabase.from('raid_reads').select('raid_id, last_read_at').eq('user_id', userId),
  ]);

  if (error) return { active: [], expired: [], error };

  const lastReadByRaid = new Map<string, string>();
  for (const r of (readRows ?? []) as Array<{ raid_id: string; last_read_at: string }>) {
    lastReadByRaid.set(r.raid_id, r.last_read_at);
  }

  const all = (data ?? []) as RaidWithAttendees[];
  for (const raid of all) {
    const joined = raid.raid_attendees.some(a => a.user_id === userId);
    if (!joined) {
      raid.unread_count = 0;
      continue;
    }
    const since = lastReadByRaid.get(raid.id);
    raid.unread_count = raid.raid_messages.filter(
      m => m.user_id !== userId && (!since || new Date(m.created_at) > new Date(since))
    ).length;
  }

  const active = all.filter(isActive);
  const expired = all.filter(r => !isActive(r));

  return { active, expired, error: null };
}

// Upsert this user's last_read_at = NOW() for one raid. Called by the raid
// detail page on every visit so opening its chat clears the unread badge —
// mirrors markChannelRead/markDMRead.
export async function markRaidRead(userId: string, raidId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('raid_reads')
    .upsert(
      { user_id: userId, raid_id: raidId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,raid_id' }
    );
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
