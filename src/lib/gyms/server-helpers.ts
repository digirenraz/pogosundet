import { createClient } from '@/lib/supabase/server';
import { normalizeGymName } from './helpers';
import type { GymLocation } from './maps';

// Server-side helpers for the `gyms` table (migration 018). The client-side
// helpers live in `helpers.ts` — don't mix the two Supabase clients.

// Escape PostgREST LIKE/ILIKE pattern characters so the name is matched
// literally. Backslash first, or the escapes themselves would get escaped.
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// Look up a gym's exact coordinates by name, case-insensitively (ilike with
// every wildcard escaped = case-insensitive equality, mirroring the unique
// index on lower(name)). Returns null when the gym isn't in the table, has no
// coordinates yet (auto-learned name-only rows), or the query errors — the
// caller falls back to a name search, so this must never throw to the page.
export async function getGymLocation(name: string): Promise<GymLocation | null> {
  const normalized = normalizeGymName(name);
  if (!normalized) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('gyms')
    .select('lat, lng')
    .ilike('name', escapeIlike(normalized))
    .maybeSingle();

  if (error || !data) return null;
  if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return null;
  return { lat: data.lat, lng: data.lng };
}
