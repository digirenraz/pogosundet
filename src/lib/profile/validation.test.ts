import { describe, it, expect } from 'vitest';
import { validateProfile } from './validation';

describe('validateProfile', () => {
  const valid = {
    trainer_name: 'PoGoRaider',
    friend_code: '1234 5678 9012',
    first_name: '',
    bio: '',
  };

  // --- trainer_name ---

  it('passes with a valid trainer name', () => {
    const result = validateProfile(valid);
    expect(result.valid).toBe(true);
    expect(result.errors.trainer_name).toBeUndefined();
  });

  it('fails when trainer name is missing', () => {
    const result = validateProfile({ ...valid, trainer_name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.trainer_name).toBe('errorTrainerNameRequired');
  });

  it('fails when trainer name is too short (< 3 chars)', () => {
    const result = validateProfile({ ...valid, trainer_name: 'AB' });
    expect(result.valid).toBe(false);
    expect(result.errors.trainer_name).toBe('errorTrainerNameLength');
  });

  it('fails when trainer name is too long (> 24 chars)', () => {
    const result = validateProfile({ ...valid, trainer_name: 'A'.repeat(25) });
    expect(result.valid).toBe(false);
    expect(result.errors.trainer_name).toBe('errorTrainerNameLength');
  });

  it('passes trainer name at exactly 3 chars', () => {
    const result = validateProfile({ ...valid, trainer_name: 'Ace' });
    expect(result.valid).toBe(true);
  });

  it('passes trainer name at exactly 24 chars', () => {
    const result = validateProfile({ ...valid, trainer_name: 'A'.repeat(24) });
    expect(result.valid).toBe(true);
  });

  it('fails when trainer name has leading spaces', () => {
    const result = validateProfile({ ...valid, trainer_name: '  Raider' });
    expect(result.valid).toBe(false);
    expect(result.errors.trainer_name).toBe('errorTrainerNameLength');
  });

  // --- friend_code ---

  it('passes with a valid friend code', () => {
    const result = validateProfile(valid);
    expect(result.errors.friend_code).toBeUndefined();
  });

  it('fails when friend code is missing', () => {
    const result = validateProfile({ ...valid, friend_code: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.friend_code).toBe('errorFriendCodeRequired');
  });

  it('fails when friend code has wrong format (no spaces)', () => {
    const result = validateProfile({ ...valid, friend_code: '123456789012' });
    expect(result.valid).toBe(false);
    expect(result.errors.friend_code).toBe('errorFriendCodeFormat');
  });

  it('fails when friend code has letters', () => {
    const result = validateProfile({ ...valid, friend_code: 'ABCD 5678 9012' });
    expect(result.valid).toBe(false);
    expect(result.errors.friend_code).toBe('errorFriendCodeFormat');
  });

  it('passes friend code with all zeros', () => {
    const result = validateProfile({ ...valid, friend_code: '0000 0000 0000' });
    expect(result.valid).toBe(true);
  });

  // --- first_name (optional) ---

  it('passes when first name is empty', () => {
    const result = validateProfile({ ...valid, first_name: '' });
    expect(result.errors.first_name).toBeUndefined();
  });

  it('passes when first name is undefined', () => {
    const result = validateProfile({ ...valid, first_name: undefined });
    expect(result.errors.first_name).toBeUndefined();
  });

  it('fails when first name is too long (> 50 chars)', () => {
    const result = validateProfile({ ...valid, first_name: 'A'.repeat(51) });
    expect(result.valid).toBe(false);
    expect(result.errors.first_name).toBe('errorFirstNameLength');
  });

  it('passes first name at exactly 50 chars', () => {
    const result = validateProfile({ ...valid, first_name: 'A'.repeat(50) });
    expect(result.errors.first_name).toBeUndefined();
  });

  // --- bio (optional) ---

  it('passes when bio is empty', () => {
    const result = validateProfile({ ...valid, bio: '' });
    expect(result.errors.bio).toBeUndefined();
  });

  it('fails when bio is too long (> 280 chars)', () => {
    const result = validateProfile({ ...valid, bio: 'A'.repeat(281) });
    expect(result.valid).toBe(false);
    expect(result.errors.bio).toBe('errorBioLength');
  });

  it('passes bio at exactly 280 chars', () => {
    const result = validateProfile({ ...valid, bio: 'A'.repeat(280) });
    expect(result.errors.bio).toBeUndefined();
  });

  // --- team (optional) ---

  it('passes when team is undefined', () => {
    const result = validateProfile({ ...valid, team: undefined });
    expect(result.errors.team).toBeUndefined();
  });

  it('passes when team is mystic', () => {
    const result = validateProfile({ ...valid, team: 'mystic' });
    expect(result.valid).toBe(true);
  });

  it('passes when team is valor', () => {
    const result = validateProfile({ ...valid, team: 'valor' });
    expect(result.valid).toBe(true);
  });

  it('passes when team is instinct', () => {
    const result = validateProfile({ ...valid, team: 'instinct' });
    expect(result.valid).toBe(true);
  });

  it('fails when team is an unknown value', () => {
    const result = validateProfile({
      ...valid,
      team: 'rocket' as unknown as 'mystic' | 'valor' | 'instinct',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.team).toBe('errorTeamInvalid');
  });

  // --- level (optional) ---

  it('passes when level is undefined', () => {
    const result = validateProfile({ ...valid, level: undefined });
    expect(result.errors.level).toBeUndefined();
  });

  it('passes level at exactly 1', () => {
    const result = validateProfile({ ...valid, level: 1 });
    expect(result.valid).toBe(true);
  });

  it('passes level at exactly 80', () => {
    const result = validateProfile({ ...valid, level: 80 });
    expect(result.valid).toBe(true);
  });

  it('fails when level is 0', () => {
    const result = validateProfile({ ...valid, level: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.level).toBe('errorLevelRange');
  });

  it('fails when level is 81', () => {
    const result = validateProfile({ ...valid, level: 81 });
    expect(result.valid).toBe(false);
    expect(result.errors.level).toBe('errorLevelRange');
  });

  it('fails when level is not an integer', () => {
    const result = validateProfile({ ...valid, level: 42.5 });
    expect(result.valid).toBe(false);
    expect(result.errors.level).toBe('errorLevelRange');
  });

  // --- multiple errors at once ---

  it('returns multiple errors when both required fields are missing', () => {
    const result = validateProfile({ ...valid, trainer_name: '', friend_code: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.trainer_name).toBe('errorTrainerNameRequired');
    expect(result.errors.friend_code).toBe('errorFriendCodeRequired');
  });
});
