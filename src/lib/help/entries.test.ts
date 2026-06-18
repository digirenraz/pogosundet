import { describe, it, expect } from 'vitest';
import { HELP_ENTRIES, type HelpEntry } from './entries';

describe('HELP_ENTRIES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(HELP_ENTRIES)).toBe(true);
    expect(HELP_ENTRIES.length).toBeGreaterThan(0);
  });

  it('every entry has a non-empty id, title, and body', () => {
    for (const entry of HELP_ENTRIES) {
      expect(entry.id.trim().length).toBeGreaterThan(0);
      expect(entry.title.trim().length).toBeGreaterThan(0);
      expect(entry.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    const ids = HELP_ENTRIES.map((e: HelpEntry) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
