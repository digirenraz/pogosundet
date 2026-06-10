import { describe, it, expect } from 'vitest';
import { normalizeGymName, isKnownGym } from './helpers';

describe('normalizeGymName', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeGymName('  Frederikssund Kirke  ')).toBe('Frederikssund Kirke');
  });

  it('collapses internal whitespace runs to single spaces', () => {
    expect(normalizeGymName('Fraktalskulptur   Ved\t Station')).toBe(
      'Fraktalskulptur Ved Station'
    );
  });

  it('passes an already-clean name through unchanged', () => {
    expect(normalizeGymName('Slottet')).toBe('Slottet');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(normalizeGymName('   ')).toBe('');
  });
});

describe('isKnownGym', () => {
  const gyms = ['Frederikssund Kirke', 'Fraktalskulptur Ved Station', 'Slottet'];

  it('matches case-insensitively', () => {
    expect(isKnownGym(gyms, 'frederikssund kirke')).toBe(true);
    expect(isKnownGym(gyms, 'SLOTTET')).toBe(true);
  });

  it('returns false for a gym not in the list', () => {
    expect(isKnownGym(gyms, 'Ukendt Gym')).toBe(false);
  });

  it('normalizes the candidate name before comparing', () => {
    expect(isKnownGym(gyms, '  slottet  ')).toBe(true);
    expect(isKnownGym(gyms, 'frederikssund   kirke')).toBe(true);
  });
});
