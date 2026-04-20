// Server-only helpers — uses the server Supabase client (cookies-based).
// Do NOT import this file from client components.
import { createClient } from '@/lib/supabase/server';
import type { Profile } from './helpers';

// Fetch all profiles ordered by newest first.
// Called from Server Components (e.g. the Player Directory page).
export async function getAllProfiles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: (data as Profile[]) ?? [], error };
}
