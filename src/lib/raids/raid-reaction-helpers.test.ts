import { describe, it, expect } from 'vitest';
import { groupRaidReactions, reactorName } from './raid-reaction-helpers';

describe('groupRaidReactions', () => {
  it('groups rows by reaction code into user_id lists', () => {
    const grouped = groupRaidReactions([
      { user_id: 'a', reaction: 'tfr' },
      { user_id: 'b', reaction: 'tfr' },
      { user_id: 'a', reaction: 'shiny' },
    ]);
    expect(grouped).toEqual({ tfr: ['a', 'b'], shiny: ['a'], hundo: [] });
  });

  it('ignores unknown reaction codes', () => {
    const grouped = groupRaidReactions([
      { user_id: 'a', reaction: 'bogus' },
      { user_id: 'a', reaction: 'hundo' },
    ]);
    expect(grouped).toEqual({ tfr: [], shiny: [], hundo: ['a'] });
  });

  it('de-duplicates user_ids defensively', () => {
    const grouped = groupRaidReactions([
      { user_id: 'a', reaction: 'tfr' },
      { user_id: 'a', reaction: 'tfr' },
    ]);
    expect(grouped.tfr).toEqual(['a']);
  });
});

describe('reactorName', () => {
  const names = { u1: 'Renraz', u2: 'MikkelMystic' };

  it('shows the you-label for the current user', () => {
    expect(reactorName('me', 'me', names, 'Dig', 'En træner')).toBe('Dig');
  });

  it('resolves a known user_id to its trainer name', () => {
    expect(reactorName('u2', 'me', names, 'Dig', 'En træner')).toBe('MikkelMystic');
  });

  it('falls back to the unknown-label for an unmapped user_id', () => {
    expect(reactorName('ghost', 'me', names, 'Dig', 'En træner')).toBe('En træner');
  });

  it('prefers the you-label even when the current user is also in the map', () => {
    expect(reactorName('u1', 'u1', names, 'Dig', 'En træner')).toBe('Dig');
  });
});
