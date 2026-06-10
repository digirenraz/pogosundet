import { createClient } from '@/lib/supabase/client';

// Helpers for the community-maintained `gyms` table (migration 018).
// Gym names come from PM seeding (docs/gyms-seeding.md) plus auto-learning:
// every gym name submitted with a raid is inserted best-effort, so the list
// grows itself with zero admin burden (same philosophy as the raid-boss list).

// Normalize a user-typed gym name: trim and collapse internal whitespace runs
// to single spaces, so "  Slottet " and "Slottet" dedupe to the same row.
export function normalizeGymName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

// Case-insensitive membership test: is `name` (after normalization) already
// in the list of known gym names?
export function isKnownGym(gyms: string[], name: string): boolean {
  const needle = normalizeGymName(name).toLowerCase();
  return gyms.some(g => g.toLowerCase() === needle);
}

// Fetch all known gym names, alphabetically. Returns [] on any error so the
// form's free-text fallback keeps working — including during the window
// before migration 018 is applied to the shared DB (the query just errors
// and the user types the gym name manually).
export async function fetchGymNames(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('gyms')
    .select('name')
    .order('name');
  if (error || !data) return [];
  return data.map(row => row.name as string);
}

// Auto-learn a gym name after a raid is posted. Best-effort by design:
// a plain INSERT where ALL errors are ignored — including 23505 duplicates,
// which the unique index on lower(name) (migration 018) raises for
// concurrent or case-variant inserts of the same gym. The raid flow must
// never block or fail because of this write; callers fire-and-forget it.
export async function learnGym(name: string): Promise<void> {
  const normalized = normalizeGymName(name);
  if (!normalized) return;
  const supabase = createClient();
  await supabase.from('gyms').insert({ name: normalized });
}
