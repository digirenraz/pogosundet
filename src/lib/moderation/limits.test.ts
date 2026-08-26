import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MODERATOR_NOTE_MAX_LENGTH,
  REPORT_NOTE_MAX_LENGTH,
} from './types';

// Guards the TypeScript length caps against the DB CHECK constraints they are
// supposed to mirror.
//
// This drift is silent and one-directional: if the DB cap is LOWER than the TS
// cap, nothing rejects the input up front — the textarea accepts it,
// validateReport/validateModeration accept it, and the write then fails inside
// the RPC, surfacing as an unexplained 500 with the moderation action silently
// not applied. That exact mismatch shipped in review (banned_reason capped at
// 500 while the shared moderator-note textarea allowed 1000).
//
// Parsing the migration is deliberate: these constraints live in SQL that no
// unit test would otherwise touch, and the migration is applied by hand, so
// there is no runtime that would catch the mismatch earlier.
const MIGRATION = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/024_moderation.sql'),
  'utf8'
);

// Pull `length(<column>) <= <n>` out of the migration.
function checkLimitFor(column: string): number {
  const match = MIGRATION.match(
    new RegExp(`length\\(${column}\\)\\s*<=\\s*(\\d+)`)
  );
  if (!match) {
    throw new Error(
      `No CHECK (length(${column}) <= n) found in 024_moderation.sql — ` +
        'the constraint was renamed or removed; update this test with it.'
    );
  }
  return Number(match[1]);
}

describe('moderation length limits stay in sync with the DB', () => {
  it('profiles.banned_reason matches MODERATOR_NOTE_MAX_LENGTH', () => {
    // The ban reason and the warning DM share one textarea, so the ban-reason
    // column must accept everything that textarea allows.
    expect(checkLimitFor('banned_reason')).toBe(MODERATOR_NOTE_MAX_LENGTH);
  });

  it('message_reports.moderator_note matches MODERATOR_NOTE_MAX_LENGTH', () => {
    expect(checkLimitFor('moderator_note')).toBe(MODERATOR_NOTE_MAX_LENGTH);
  });

  it('message_reports.note matches REPORT_NOTE_MAX_LENGTH', () => {
    expect(checkLimitFor('note')).toBe(REPORT_NOTE_MAX_LENGTH);
  });
});
