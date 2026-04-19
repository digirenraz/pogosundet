import { describe, it, expect } from 'vitest';
import { validateRaid } from './validation';

describe('validateRaid', () => {
  // --- minimum requirement: at least one of image_url, gym_name, boss_name ---

  it('passes with image_url only', () => {
    const result = validateRaid({ image_url: 'https://example.com/raid.jpg' });
    expect(result.valid).toBe(true);
    expect(result.errors.form).toBeUndefined();
  });

  it('passes with gym_name only', () => {
    const result = validateRaid({ gym_name: 'Frederikssund Kirke' });
    expect(result.valid).toBe(true);
  });

  it('passes with boss_name only', () => {
    const result = validateRaid({ boss_name: 'Mewtwo' });
    expect(result.valid).toBe(true);
  });

  it('passes with gym_name and boss_name', () => {
    const result = validateRaid({ gym_name: 'Slottet', boss_name: 'Rayquaza' });
    expect(result.valid).toBe(true);
  });

  it('passes with all fields provided', () => {
    const result = validateRaid({
      image_url: 'https://example.com/raid.jpg',
      gym_name: 'Slottet',
      boss_name: 'Mewtwo',
      starts_at: new Date().toISOString(),
      note: 'Kom gerne 5 min før',
    });
    expect(result.valid).toBe(true);
  });

  it('fails when all fields are empty', () => {
    const result = validateRaid({});
    expect(result.valid).toBe(false);
    expect(result.errors.form).toBe('errorAtLeastOne');
  });

  it('fails when only note is provided (note alone is not enough)', () => {
    const result = validateRaid({ note: 'Vigtigt raid!' });
    expect(result.valid).toBe(false);
    expect(result.errors.form).toBe('errorAtLeastOne');
  });

  it('fails when only starts_at is provided', () => {
    const result = validateRaid({ starts_at: new Date().toISOString() });
    expect(result.valid).toBe(false);
    expect(result.errors.form).toBe('errorAtLeastOne');
  });

  it('fails when image_url is an empty string', () => {
    const result = validateRaid({ image_url: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.form).toBe('errorAtLeastOne');
  });

  it('fails when gym_name is whitespace only', () => {
    const result = validateRaid({ gym_name: '   ' });
    expect(result.valid).toBe(false);
    expect(result.errors.form).toBe('errorAtLeastOne');
  });
});
