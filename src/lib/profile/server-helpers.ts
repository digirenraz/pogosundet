// Server-only helpers — uses the server Supabase client (cookies-based).
// Do NOT import this file from client components.
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile } from './helpers';

// Cached fetch of all profiles, revalidated every 60 seconds.
// Uses the admin client (no cookies) so unstable_cache can safely store the result
// across requests. Profile creates/edits are reflected within one TTL cycle;
// account deletions call revalidateTag('profiles') immediately via the delete route.
export const getAllProfiles = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    return { data: (data as Profile[]) ?? [], error };
  },
  ['all-profiles'],
  { revalidate: 60, tags: ['profiles'] }
);
