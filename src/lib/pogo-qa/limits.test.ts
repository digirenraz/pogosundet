import { describe, it, expect } from 'vitest';
import { rateLimitWindows } from './limits';
import {
  USER_LIMIT_PER_HOUR,
  USER_LIMIT_PER_DAY,
  GLOBAL_LIMIT_PER_DAY,
} from './types';

// Fixed clock, so the window maths is deterministic. Deliberately mid-afternoon
// Danish summer time — the windows are rolling, so the result must not depend on
// where the calendar day boundary falls.
const NOW = new Date('2026-09-13T14:37:21.000+02:00');

describe('rateLimitWindows', () => {
  it('returns an hour and a day before now, as ISO strings', () => {
    const { hourAgo, dayAgo } = rateLimitWindows(NOW);

    expect(hourAgo).toBe('2026-09-13T11:37:21.000Z');
    expect(dayAgo).toBe('2026-09-12T12:37:21.000Z');
  });

  it('rolls, rather than snapping to a calendar boundary', () => {
    // A calendar-day reset would let someone spend a full allowance at 23:59 and
    // another at 00:01. These cutoffs must carry the time of day.
    const lateEvening = new Date('2026-09-13T23:59:00.000Z');
    const { dayAgo } = rateLimitWindows(lateEvening);

    expect(dayAgo).toBe('2026-09-12T23:59:00.000Z');
  });

  it('moves the cutoff with the clock', () => {
    const later = new Date(NOW.getTime() + 30 * 60 * 1000);

    expect(rateLimitWindows(later).hourAgo > rateLimitWindows(NOW).hourAgo).toBe(true);
    expect(rateLimitWindows(later).dayAgo > rateLimitWindows(NOW).dayAgo).toBe(true);
  });

  it('survives a DST boundary without drifting', () => {
    // Denmark leaves summer time on 2026-10-25. The windows are pure UTC
    // arithmetic, so an hour before 02:30 CEST is 01:30 CEST regardless.
    const acrossDst = new Date('2026-10-25T02:30:00.000Z');
    const { hourAgo } = rateLimitWindows(acrossDst);

    expect(hourAgo).toBe('2026-10-25T01:30:00.000Z');
  });
});

describe('rate limit constants', () => {
  it('keeps the hourly limit below the daily one', () => {
    // An hourly cap at or above the daily cap would be dead code.
    expect(USER_LIMIT_PER_HOUR).toBeLessThan(USER_LIMIT_PER_DAY);
  });

  it('keeps the global ceiling above a single member daily allowance', () => {
    // Otherwise a single member could exhaust the whole community's budget and
    // the "global" scope would just be a second per-user limit.
    expect(GLOBAL_LIMIT_PER_DAY).toBeGreaterThan(USER_LIMIT_PER_DAY);
  });
});
