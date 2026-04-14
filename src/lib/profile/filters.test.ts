import { describe, it, expect } from 'vitest';
import { filterProfiles } from './filters';
import type { Profile } from './helpers';

const profiles: Profile[] = [
  {
    id: '1', user_id: 'u1',
    trainer_name: 'RaidMaster99', friend_code: '1111 2222 3333',
    first_name: 'Alex', bio: 'Active downtown',
  },
  {
    id: '2', user_id: 'u2',
    trainer_name: 'ShinyHunterJess', friend_code: '4444 5555 6666',
    first_name: 'Jessica', bio: 'Weekend player',
  },
  {
    id: '3', user_id: 'u3',
    trainer_name: 'SnorlaxSleeper', friend_code: '7777 8888 9999',
    // no first_name, no bio
  },
];

describe('filterProfiles', () => {
  it('returns all profiles when query is empty', () => {
    expect(filterProfiles(profiles, '')).toHaveLength(3);
  });

  it('returns all profiles when query is only whitespace', () => {
    expect(filterProfiles(profiles, '   ')).toHaveLength(3);
  });

  it('matches trainer_name case-insensitively', () => {
    const result = filterProfiles(profiles, 'raidmaster');
    expect(result).toHaveLength(1);
    expect(result[0].trainer_name).toBe('RaidMaster99');
  });

  it('matches first_name case-insensitively', () => {
    const result = filterProfiles(profiles, 'jessica');
    expect(result).toHaveLength(1);
    expect(result[0].first_name).toBe('Jessica');
  });

  it('returns empty array when nothing matches', () => {
    expect(filterProfiles(profiles, 'pikachu')).toHaveLength(0);
  });

  it('handles profiles with no first_name without throwing', () => {
    const result = filterProfiles(profiles, 'snorlax');
    expect(result).toHaveLength(1);
    expect(result[0].trainer_name).toBe('SnorlaxSleeper');
  });

  it('trims whitespace from the query', () => {
    const result = filterProfiles(profiles, '  alex  ');
    expect(result).toHaveLength(1);
    expect(result[0].first_name).toBe('Alex');
  });

  it('returns multiple results when several match', () => {
    // Both RaidMaster99 and SnorlaxSleeper contain no match, but 'er' matches ShinyHunterJess and SnorlaxSleeper
    const result = filterProfiles(profiles, 'er');
    expect(result.length).toBeGreaterThan(1);
  });
});
