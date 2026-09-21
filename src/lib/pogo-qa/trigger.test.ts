import { describe, it, expect } from 'vitest';
import { parseQuestion, looksLikeQuestion } from './trigger';
import { MAX_QUESTION_LENGTH, QA_TRIGGER } from './types';

describe('parseQuestion', () => {
  it('extracts the question after the trigger', () => {
    expect(parseQuestion('!pogo hvad er en god counter til Mega Gengar?')).toBe(
      'hvad er en god counter til Mega Gengar?'
    );
  });

  it('matches the trigger case-insensitively', () => {
    // Phone keyboards capitalise the first word of a message.
    expect(parseQuestion('!POGO hvad er raid-bossen nu?')).toBe('hvad er raid-bossen nu?');
    expect(parseQuestion('!Pogo hvad er raid-bossen nu?')).toBe('hvad er raid-bossen nu?');
  });

  it('ignores leading whitespace', () => {
    expect(parseQuestion('   !pogo hvornår er raid hour?')).toBe('hvornår er raid hour?');
  });

  it('collapses the whitespace between trigger and question', () => {
    expect(parseQuestion('!pogo    hvad er en lure module?')).toBe('hvad er en lure module?');
    expect(parseQuestion('!pogo\nhvad er en lure module?')).toBe('hvad er en lure module?');
  });

  it('requires a word boundary after the trigger', () => {
    // Without this, a future "!pogostats" command would be eaten by this one.
    expect(parseQuestion('!pogoify noget')).toBeNull();
    expect(parseQuestion('!pogostats')).toBeNull();
  });

  it('requires the trigger at the start', () => {
    expect(parseQuestion('kan nogen !pogo spørge om det?')).toBeNull();
  });

  it('rejects a bare trigger with no question', () => {
    expect(parseQuestion('!pogo')).toBeNull();
    expect(parseQuestion('!pogo   ')).toBeNull();
    expect(parseQuestion('  !pogo \n ')).toBeNull();
  });

  it('rejects an over-long question', () => {
    const long = 'a'.repeat(MAX_QUESTION_LENGTH + 1);
    expect(parseQuestion(`!pogo ${long}`)).toBeNull();
  });

  it('accepts a question exactly at the limit', () => {
    const exact = 'a'.repeat(MAX_QUESTION_LENGTH);
    expect(parseQuestion(`!pogo ${exact}`)).toBe(exact);
  });

  it('ignores an ordinary message', () => {
    expect(parseQuestion('skal vi raide kl 18?')).toBeNull();
    expect(parseQuestion('')).toBeNull();
  });

  it('pins the trigger string', () => {
    // The client, the docs and the channel descriptions all quote this literal.
    expect(QA_TRIGGER).toBe('!pogo');
  });
});

describe('looksLikeQuestion', () => {
  it('is true for a well-formed question', () => {
    expect(looksLikeQuestion('!pogo hvad er raid-bossen?')).toBe(true);
  });

  it('is true for a bare trigger, unlike parseQuestion', () => {
    // Typing the trigger shows intent to use the bot, so the consent explainer
    // must appear even though there is nothing to ask yet.
    expect(looksLikeQuestion('!pogo')).toBe(true);
    expect(parseQuestion('!pogo')).toBeNull();
  });

  it('is true for an over-long question, unlike parseQuestion', () => {
    const body = `!pogo ${'a'.repeat(MAX_QUESTION_LENGTH + 1)}`;
    expect(looksLikeQuestion(body)).toBe(true);
    expect(parseQuestion(body)).toBeNull();
  });

  it('is false without the word boundary', () => {
    expect(looksLikeQuestion('!pogoify')).toBe(false);
  });

  it('is false for an ordinary message', () => {
    expect(looksLikeQuestion('hej alle sammen')).toBe(false);
  });
});
