import { describe, it, expect } from 'vitest';
import { buildScanStatusMap } from './scan-status';

describe('buildScanStatusMap', () => {
  it('returns an empty object for null/undefined/empty input', () => {
    expect(buildScanStatusMap(null)).toEqual({});
    expect(buildScanStatusMap(undefined)).toEqual({});
    expect(buildScanStatusMap([])).toEqual({});
  });

  it('keys statuses by target_user_id', () => {
    const map = buildScanStatusMap([
      { target_user_id: 'u1', status: 'added' },
      { target_user_id: 'u2', status: 'skipped' },
    ]);
    expect(map).toEqual({ u1: 'added', u2: 'skipped' });
  });

  it('ignores rows with an unexpected status value', () => {
    const map = buildScanStatusMap([
      { target_user_id: 'u1', status: 'added' },
      // @ts-expect-error — exercising a malformed row from the DB
      { target_user_id: 'u2', status: 'bogus' },
    ]);
    expect(map).toEqual({ u1: 'added' });
  });

  it('last row wins on a duplicate target (defensive — PK prevents this in the DB)', () => {
    const map = buildScanStatusMap([
      { target_user_id: 'u1', status: 'skipped' },
      { target_user_id: 'u1', status: 'added' },
    ]);
    expect(map).toEqual({ u1: 'added' });
  });
});
