import { describe, it, expect } from 'vitest';
import { CHANGELOG_ENTRIES } from './entries';

// The changelog is user-facing content (Danish, 1–2 sentences per entry).
// These tests pin the data invariants the UI relies on: valid ISO dates,
// newest-first ordering, and non-empty texts.
describe('CHANGELOG_ENTRIES', () => {
  it('has at least 10 entries (the initial seed)', () => {
    expect(CHANGELOG_ENTRIES.length).toBeGreaterThanOrEqual(10);
  });

  it('every entry has a valid YYYY-MM-DD date', () => {
    for (const entry of CHANGELOG_ENTRIES) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Must also be a real calendar date, not e.g. 2026-13-45.
      const parsed = new Date(entry.date);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
      expect(parsed.toISOString().slice(0, 10)).toBe(entry.date);
    }
  });

  it('is sorted newest first', () => {
    for (let i = 1; i < CHANGELOG_ENTRIES.length; i++) {
      expect(
        CHANGELOG_ENTRIES[i - 1].date >= CHANGELOG_ENTRIES[i].date,
        `entry ${i - 1} (${CHANGELOG_ENTRIES[i - 1].date}) should not be older than entry ${i} (${CHANGELOG_ENTRIES[i].date})`
      ).toBe(true);
    }
  });

  it('every entry has non-empty text', () => {
    for (const entry of CHANGELOG_ENTRIES) {
      expect(entry.text.trim().length).toBeGreaterThan(0);
    }
  });
});
