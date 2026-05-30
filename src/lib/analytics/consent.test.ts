import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredConsent, setStoredConsent } from './consent';

const STORAGE_KEY = 'pogo-analytics-consent';

describe('analytics consent store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null when no choice has been stored', () => {
    expect(getStoredConsent()).toBeNull();
  });

  it('round-trips a granted choice', () => {
    setStoredConsent('granted');
    expect(getStoredConsent()).toBe('granted');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('granted');
  });

  it('round-trips a denied choice', () => {
    setStoredConsent('denied');
    expect(getStoredConsent()).toBe('denied');
  });

  it('lets a later choice overwrite an earlier one', () => {
    setStoredConsent('denied');
    setStoredConsent('granted');
    expect(getStoredConsent()).toBe('granted');
  });

  it('treats an unrecognised stored value as undecided (null)', () => {
    // Simulate a stale / tampered value written outside the setter.
    window.localStorage.setItem(STORAGE_KEY, 'maybe');
    expect(getStoredConsent()).toBeNull();
  });

  it('treats an empty stored value as undecided (null)', () => {
    window.localStorage.setItem(STORAGE_KEY, '');
    expect(getStoredConsent()).toBeNull();
  });
});
