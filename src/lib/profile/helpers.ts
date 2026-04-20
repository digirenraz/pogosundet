import { createClient } from '@/lib/supabase/client';
import type { ProfileInput } from './validation';

export interface Profile extends ProfileInput {
  id: string;
  user_id: string;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
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

// Fetch a profile by auth user ID. Returns null data (not an error) if not found.
export async function getProfile(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
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
