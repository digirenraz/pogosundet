import type { Profile } from './helpers';
import type { Team } from './validation';

// 'all' = no team constraint; 'online' = restrict to currently-online users
// (regardless of team); a Team value restricts to that team only.
export type DirectoryFilter = 'all' | 'online' | Team;

export interface FilterOptions {
  query?: string;
  filter?: DirectoryFilter;
  onlineUserIds?: Set<string>;
}

// Filter profiles by trainer_name / first_name and team / online presence.
// Case-insensitive, trims whitespace. Returns all profiles when nothing is set.
export function filterProfiles(profiles: Profile[], options: FilterOptions = {}): Profile[] {
  const { query = '', filter = 'all', onlineUserIds } = options;
  const q = query.toLowerCase().trim();

  return profiles.filter((p) => {
    if (filter === 'online') {
      if (!onlineUserIds || !onlineUserIds.has(p.user_id)) return false;
    } else if (filter !== 'all') {
      if (p.team !== filter) return false;
    }

    if (!q) return true;
    const trainer = p.trainer_name.toLowerCase();
    const first = (p.first_name ?? '').toLowerCase();
    return trainer.includes(q) || first.includes(q);
  });
}
