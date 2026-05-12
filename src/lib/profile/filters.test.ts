import { describe, it, expect } from 'vitest';
import { filterProfiles } from './filters';
import type { Profile } from './helpers';

const profiles: Profile[] = [
  {
    id: '1', user_id: 'u1',
    trainer_name: 'RaidMaster99', friend_code: '1111 2222 3333',
    first_name: 'Alex', bio: 'Active downtown',
    team: 'mystic', level: 40,
  },
  {
    id: '2', user_id: 'u2',
    trainer_name: 'ShinyHunterJess', friend_code: '4444 5555 6666',
    first_name: 'Jessica', bio: 'Weekend player',
    team: 'valor', level: 35,
  },
  {
    id: '3', user_id: 'u3',
    trainer_name: 'SnorlaxSleeper', friend_code: '7777 8888 9999',
    // no first_name, no bio, no team, no level
  },
];

describe('filterProfiles', () => {
  it('returns all profiles when no options', () => {
    expect(filterProfiles(profiles)).toHaveLength(3);
  });

  it('returns all profiles when query is empty', () => {
    expect(filterProfiles(profiles, { query: '' })).toHaveLength(3);
  });

  it('returns all profiles when query is only whitespace', () => {
    expect(filterProfiles(profiles, { query: '   ' })).toHaveLength(3);
  });

  it('matches trainer_name case-insensitively', () => {
    const result = filterProfiles(profiles, { query: 'raidmaster' });
    expect(result).toHaveLength(1);
    expect(result[0].trainer_name).toBe('RaidMaster99');
  });

  it('matches first_name case-insensitively', () => {
    const result = filterProfiles(profiles, { query: 'jessica' });
    expect(result).toHaveLength(1);
    expect(result[0].first_name).toBe('Jessica');
  });

  it('returns empty array when nothing matches', () => {
    expect(filterProfiles(profiles, { query: 'pikachu' })).toHaveLength(0);
  });

  it('handles profiles with no first_name without throwing', () => {
    const result = filterProfiles(profiles, { query: 'snorlax' });
    expect(result).toHaveLength(1);
    expect(result[0].trainer_name).toBe('SnorlaxSleeper');
  });

  it('trims whitespace from the query', () => {
    const result = filterProfiles(profiles, { query: '  alex  ' });
    expect(result).toHaveLength(1);
    expect(result[0].first_name).toBe('Alex');
  });

  it('filters by team mystic', () => {
    const result = filterProfiles(profiles, { filter: 'mystic' });
    expect(result).toHaveLength(1);
    expect(result[0].team).toBe('mystic');
  });

  it('filters by team valor', () => {
    const result = filterProfiles(profiles, { filter: 'valor' });
    expect(result).toHaveLength(1);
    expect(result[0].team).toBe('valor');
  });

  it('returns empty when no profile matches the team', () => {
    const result = filterProfiles(profiles, { filter: 'instinct' });
    expect(result).toHaveLength(0);
  });

  it('filters by online presence', () => {
    const online = new Set(['u1', 'u3']);
    const result = filterProfiles(profiles, { filter: 'online', onlineUserIds: online });
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.user_id).sort()).toEqual(['u1', 'u3']);
  });

  it('online filter returns nothing without an onlineUserIds set', () => {
    expect(filterProfiles(profiles, { filter: 'online' })).toHaveLength(0);
  });

  it('combines team filter + query', () => {
    const result = filterProfiles(profiles, { filter: 'mystic', query: 'raid' });
    expect(result).toHaveLength(1);
    expect(result[0].trainer_name).toBe('RaidMaster99');
  });
});
