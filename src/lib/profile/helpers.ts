import { createClient } from '@/lib/supabase/client';
import type { ProfileInput } from './validation';

export interface Profile extends ProfileInput {
  id: string;
  user_id: string;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
  last_seen_at?: string | null;
}

// Insert a new profile row. Returns { data, error } mirroring Supabase conventions.
export async function createProfile(input: ProfileInput & { user_id: string }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .insert(input)
    .select()
    .single();
  return { data: data as Profile | null, error };
}

// Fetch the authenticated user's own profile, including friend_code.
// Migration 022 revoked SELECT (friend_code) from the authenticated role, so a
// direct table query would lose the field. get_own_profile() is a SECURITY
// DEFINER RPC that bypasses the column restriction while enforcing the
// owner-only filter (WHERE user_id = auth.uid()) at the DB level.
export async function getProfile() {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('get_own_profile')
    .single();
  return { data: data as Profile | null, error };
}

// Update an existing profile row. Returns the updated row.
export async function updateProfile(userId: string, input: ProfileInput) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update(input)
    .eq('user_id', userId)
    .select()
    .single();
  return { data: data as Profile | null, error };
}
