// Server-only helpers — uses the server Supabase client (cookies-based).
// Do NOT import this file from client components.
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile } from './helpers';

// Cached fetch of all profiles, revalidated every 60 seconds.
// Uses the admin client (no cookies) so unstable_cache can safely store the result
// across requests. Profile creates/edits are reflected within one TTL cycle;
// account deletions call revalidateTag('profiles') immediately via the delete route.
//
// Excludes bot accounts (migration 023). The event bot needs a real profiles row
// because channel_messages.user_id FKs to profiles(user_id), but it is not a
// member — without this filter it shows up as a player card in /players, in the
// online strip, in the channel members sheet and in the DM picker.
//
// Explicit column list — deliberately NOT `select('*')`.
//
// This runs on the ADMIN client (service role), which bypasses RLS and the
// column-level REVOKEs in migrations 022/024. The result is handed to client
// components (e.g. PlayersScreen on /players), and props crossing the
// Server→Client boundary are serialised into the RSC payload as real objects —
// a TypeScript cast strips nothing at runtime. So `select('*')` would ship
// every column of every profile to every signed-in user's browser, including
// the moderation columns added in migration 024: `is_admin`, `banned_at` and
// `banned_reason` (a moderator's free-text note about a user).
//
// Listing columns explicitly means a newly added profile column is private by
// default and has to be opted in here, rather than leaking the moment it exists.
const PUBLIC_PROFILE_COLUMNS = [
  'id',
  'user_id',
  'trainer_name',
  'friend_code',
  'first_name',
  'bio',
  'avatar_url',
  'team',
  'level',
  'last_seen_at',
  'hide_friend_code',
  'created_at',
  'updated_at',
].join(', ');

export const getAllProfiles = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq('is_bot', false)
      .order('created_at', { ascending: false });
    return { data: (data as unknown as Profile[]) ?? [], error };
  },
  ['all-profiles'],
  { revalidate: 60, tags: ['profiles'] }
);

// Bot profiles, kept separate from getAllProfiles so they can be used to render
// a message author WITHOUT appearing anywhere a member list is drawn.
//
// Why this is needed: server-rendered messages resolve their author through the
// PostgREST embed on channel_messages_profile_fk, but a Realtime INSERT carries
// no join — the client resolves it from the profile snapshot instead. Since the
// bot is (correctly) absent from that snapshot, a live-arriving bot message
// would render as "—" with a "?" avatar until the next page load.
export const getBotProfiles = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('profiles').select('*').eq('is_bot', true);
    return { data: (data as Profile[]) ?? [], error };
  },
  ['bot-profiles'],
  { revalidate: 3600, tags: ['profiles'] }
);

// Withhold the friend code from users who shouldn't see it (issue #101).
// For every profile that has opted to hide its code (`hide_friend_code`), set
// `friend_code` to '' UNLESS the viewer is that profile's owner — so a hidden
// code never reaches another user's browser, while the owner still sees their
// own. `hide_friend_code` itself is left intact so the UI can render the
// blurred placeholder. Pure: returns a new array, does not mutate the input.
//
// Apply this at the page level (where the viewer's id is known) rather than
// inside the globally-cached getAllProfiles — the cache is shared across all
// users, and the owner's own QR view (/profile → /players/{own id}) is fed by
// the same data, so a blanket scrub would hide the owner's own code from them.
export function redactHiddenFriendCodes(
  profiles: Profile[],
  viewerUserId: string | null | undefined
): Profile[] {
  return profiles.map((p) =>
    p.hide_friend_code && p.user_id !== viewerUserId
      ? { ...p, friend_code: '' }
      : p
  );
}
