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
export const getAllProfiles = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_bot', false)
      .order('created_at', { ascending: false });
    return { data: (data as Profile[]) ?? [], error };
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
