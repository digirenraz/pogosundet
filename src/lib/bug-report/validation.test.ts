import { describe, it, expect } from 'vitest';
import { validateBugReport } from './validation';

describe('validateBugReport', () => {
  it('accepts a valid title and description (happy path)', () => {
    const result = validateBugReport({
      title: 'Appen crasher på raid-siden',
      description: 'Når jeg åbner et raid og trykker tilbage, fryser appen helt.',
    });
    expect(result).toEqual({
      ok: true,
      title: 'Appen crasher på raid-siden',
      description: 'Når jeg åbner et raid og trykker tilbage, fryser appen helt.',
    });
  });

  it('trims surrounding whitespace from both fields', () => {
    const result = validateBugReport({
      title: '  Fejl i chatten  ',
      description: '  Beskeder vises dobbelt, når jeg sender dem hurtigt.  ',
    });
    expect(result).toEqual({
      ok: true,
      title: 'Fejl i chatten',
      description: 'Beskeder vises dobbelt, når jeg sender dem hurtigt.',
    });
  });

  it('rejects a title shorter than 3 chars (after trimming)', () => {
    expect(validateBugReport({ title: 'ab', description: 'En gyldig beskrivelse her.' }))
      .toEqual({ ok: false, error: 'title' });
    // 2 chars padded with whitespace is still too short once trimmed.
    expect(validateBugReport({ title: '  ab  ', description: 'En gyldig beskrivelse her.' }))
      .toEqual({ ok: false, error: 'title' });
  });

  it('rejects a title longer than 100 chars', () => {
    expect(
      validateBugReport({ title: 'x'.repeat(101), description: 'En gyldig beskrivelse her.' })
    ).toEqual({ ok: false, error: 'title' });
    // Exactly 100 is fine.
    expect(
      validateBugReport({ title: 'x'.repeat(100), description: 'En gyldig beskrivelse her.' }).ok
    ).toBe(true);
  });

  it('rejects a whitespace-only title', () => {
    expect(validateBugReport({ title: '   ', description: 'En gyldig beskrivelse her.' }))
      .toEqual({ ok: false, error: 'title' });
  });

  it('rejects a description shorter than 10 chars (after trimming)', () => {
    expect(validateBugReport({ title: 'Gyldig titel', description: 'for kort' }))
      .toEqual({ ok: false, error: 'description' });
    expect(validateBugReport({ title: 'Gyldig titel', description: '  kort    ' }))
      .toEqual({ ok: false, error: 'description' });
    // Exactly 10 is fine.
    expect(validateBugReport({ title: 'Gyldig titel', description: 'x'.repeat(10) }).ok).toBe(true);
  });

  it('rejects a description longer than 2000 chars', () => {
    expect(validateBugReport({ title: 'Gyldig titel', description: 'x'.repeat(2001) }))
      .toEqual({ ok: false, error: 'description' });
    // Exactly 2000 is fine.
    expect(validateBugReport({ title: 'Gyldig titel', description: 'x'.repeat(2000) }).ok).toBe(true);
  });

  it('rejects a whitespace-only description', () => {
    expect(validateBugReport({ title: 'Gyldig titel', description: '      ' }))
      .toEqual({ ok: false, error: 'description' });
  });

  it('reports the title error first when both fields are invalid', () => {
    expect(validateBugReport({ title: '', description: '' }))
      .toEqual({ ok: false, error: 'title' });
  });
});
