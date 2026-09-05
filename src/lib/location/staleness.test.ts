import { describe, it, expect } from 'vitest';
import {
  locationAgeMinutes,
  locationAgeLabel,
  isStale,
  shareEndsLabel,
  minutesRemaining,
  shouldRefreshPosition,
} from './staleness';

const NOW = new Date('2026-09-05T14:00:00.000Z');
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000).toISOString();
const minutesAhead = (n: number) => new Date(NOW.getTime() + n * 60_000).toISOString();

describe('locationAgeMinutes', () => {
  it('floors to whole minutes', () => {
    expect(locationAgeMinutes(minutesAgo(0), NOW)).toBe(0);
    expect(locationAgeMinutes(minutesAgo(5.9), NOW)).toBe(5);
    expect(locationAgeMinutes(minutesAgo(61), NOW)).toBe(61);
  });

  it('clamps future timestamps to zero rather than reporting a negative age', () => {
    // Phone clocks drift; a pin must never read "set -3 min siden".
    expect(locationAgeMinutes(minutesAhead(3), NOW)).toBe(0);
  });
});

describe('isStale', () => {
  it('is false below the threshold and true at or above it', () => {
    expect(isStale(minutesAgo(9), NOW)).toBe(false);
    expect(isStale(minutesAgo(10), NOW)).toBe(true);
    expect(isStale(minutesAgo(45), NOW)).toBe(true);
  });
});

describe('locationAgeLabel', () => {
  it('covers each bucket', () => {
    expect(locationAgeLabel(minutesAgo(0), NOW)).toBe('lige nu');
    expect(locationAgeLabel(minutesAgo(1), NOW)).toBe('set 1 min siden');
    expect(locationAgeLabel(minutesAgo(24), NOW)).toBe('set 24 min siden');
    expect(locationAgeLabel(minutesAgo(59), NOW)).toBe('set 59 min siden');
    expect(locationAgeLabel(minutesAgo(60), NOW)).toBe('set for over en time siden');
  });
});

describe('shareEndsLabel', () => {
  // Built from an offset rather than setHours() so the expectation holds in
  // any TZ the suite runs in (CI is UTC, the PM's machine is CEST).
  it('formats the end time as 24-hour local clock time', () => {
    const end = new Date(NOW.getTime() + 30 * 60_000);
    const hh = String(end.getHours()).padStart(2, '0');
    const mm = String(end.getMinutes()).padStart(2, '0');
    expect(shareEndsLabel(end.toISOString(), NOW)).toBe(`til ${hh}:${mm}`);
  });

  it('pads single-digit hours and minutes to two digits', () => {
    const end = new Date('2026-09-05T00:00:00.000Z');
    // Whatever local hour that lands on, both fields must be two characters.
    const label = shareEndsLabel(end.toISOString(), new Date(end.getTime() - 60_000));
    expect(label).toMatch(/^til \d{2}:\d{2}$/);
  });

  it('returns null once the window has closed', () => {
    expect(shareEndsLabel(minutesAgo(1), NOW)).toBeNull();
  });
});

describe('minutesRemaining', () => {
  it('rounds up so a share never reads 0 min while still active', () => {
    expect(minutesRemaining(minutesAhead(46.2), NOW)).toBe(47);
    expect(minutesRemaining(minutesAhead(0.1), NOW)).toBe(1);
  });

  it('floors at zero for an expired share', () => {
    expect(minutesRemaining(minutesAgo(5), NOW)).toBe(0);
  });
});

describe('shouldRefreshPosition', () => {
  const now = 1_000_000;

  it('always writes when nothing has been written yet', () => {
    expect(shouldRefreshPosition(null, now)).toBe(true);
  });

  it('suppresses writes inside the throttle window', () => {
    expect(shouldRefreshPosition(now - 30_000, now)).toBe(false);
  });

  it('writes again once the window has passed', () => {
    expect(shouldRefreshPosition(now - 60_000, now)).toBe(true);
    expect(shouldRefreshPosition(now - 120_000, now)).toBe(true);
  });

  it('honours an explicit throttle', () => {
    expect(shouldRefreshPosition(now - 5_000, now, 1_000)).toBe(true);
    expect(shouldRefreshPosition(now - 500, now, 1_000)).toBe(false);
  });
});
