import { describe, it, expect } from 'vitest';
import { buildPlayerNamesText } from './participants';

describe('buildPlayerNamesText', () => {
  it('joins trainer names one per line in order', () => {
    const text = buildPlayerNamesText([
      { profiles: { trainer_name: 'Fggddyx' } },
      { profiles: { trainer_name: 'Renraz666170870' } },
      { profiles: { trainer_name: 'PikaMester42' } },
    ]);
    expect(text).toBe('Fggddyx\nRenraz666170870\nPikaMester42');
  });

  it('skips rows with no profile or empty/whitespace name', () => {
    const text = buildPlayerNamesText([
      { profiles: { trainer_name: 'Ash' } },
      { profiles: null },
      { profiles: { trainer_name: null } },
      { profiles: { trainer_name: '   ' } },
      { profiles: { trainer_name: 'Misty' } },
    ]);
    expect(text).toBe('Ash\nMisty');
  });

  it('trims surrounding whitespace on each name', () => {
    expect(buildPlayerNamesText([{ profiles: { trainer_name: '  Brock  ' } }])).toBe('Brock');
  });

  it('returns an empty string for no attendees', () => {
    expect(buildPlayerNamesText([])).toBe('');
  });
});
