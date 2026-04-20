import type { Profile } from './helpers';

// Filter profiles by trainer_name or first_name.
// Case-insensitive, trims whitespace. Returns all profiles when query is empty.
export function filterProfiles(profiles: Profile[], query: string): Profile[] {
  const q = query.toLowerCase().trim();
  if (!q) return profiles;
  return profiles.filter(
    (p) =>
      p.trainer_name.toLowerCase().includes(q) ||
      (p.first_name && p.first_name.toLowerCase().includes(q))
  );
}
