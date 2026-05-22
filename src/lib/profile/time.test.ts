import { describe, it, expect } from 'vitest';
import { lastSeenRelative } from './time';

// Reference point: 2026-05-22 12:00:00 UTC
const NOW = new Date('2026-05-22T12:00:00Z');

function minsAgo(min: number): string {
  return new Date(NOW.getTime() - min * 60_000).toISOString();
}

function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 3_600_000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(NOW.getTime() - d * 86_400_000).toISOString();
}

describe('lastSeenRelative', () => {
  it('returns null for null input', () => {
    expect(lastSeenRelative(null, NOW)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(lastSeenRelative(undefined, NOW)).toBeNull();
  });

  it('returns "Lige nu" for < 2 minutes ago', () => {
    expect(lastSeenRelative(minsAgo(0), NOW)).toBe('Lige nu');
    expect(lastSeenRelative(minsAgo(1), NOW)).toBe('Lige nu');
    expect(lastSeenRelative(minsAgo(1.9), NOW)).toBe('Lige nu');
  });

  it('returns "For {n} min. siden" for 2–59 minutes ago', () => {
    expect(lastSeenRelative(minsAgo(2), NOW)).toBe('For 2 min. siden');
    expect(lastSeenRelative(minsAgo(30), NOW)).toBe('For 30 min. siden');
    expect(lastSeenRelative(minsAgo(59), NOW)).toBe('For 59 min. siden');
  });

  it('returns "For en time siden" for 1–2 hours ago', () => {
    expect(lastSeenRelative(hoursAgo(1), NOW)).toBe('For en time siden');
    expect(lastSeenRelative(hoursAgo(1.5), NOW)).toBe('For en time siden');
    expect(lastSeenRelative(hoursAgo(1.99), NOW)).toBe('For en time siden');
  });

  it('returns "For {n} timer siden" for 2–24 hours ago', () => {
    expect(lastSeenRelative(hoursAgo(2), NOW)).toBe('For 2 timer siden');
    expect(lastSeenRelative(hoursAgo(12), NOW)).toBe('For 12 timer siden');
    expect(lastSeenRelative(hoursAgo(23), NOW)).toBe('For 23 timer siden');
  });

  it('returns "I går" for exactly 24 hours ago (edge case)', () => {
    expect(lastSeenRelative(hoursAgo(24), NOW)).toBe('I går');
  });

  it('returns "I går" for 1–2 days ago', () => {
    expect(lastSeenRelative(daysAgo(1), NOW)).toBe('I går');
    expect(lastSeenRelative(daysAgo(1.9), NOW)).toBe('I går');
  });

  it('returns "For {n} dage siden" for 2–7 days ago', () => {
    expect(lastSeenRelative(daysAgo(2), NOW)).toBe('For 2 dage siden');
    expect(lastSeenRelative(daysAgo(5), NOW)).toBe('For 5 dage siden');
    expect(lastSeenRelative(daysAgo(6.9), NOW)).toBe('For 6 dage siden');
  });

  it('returns "For en uge siden" for exactly 7 days ago (edge case)', () => {
    expect(lastSeenRelative(daysAgo(7), NOW)).toBe('For en uge siden');
  });

  it('returns "For en uge siden" for 7–14 days ago', () => {
    expect(lastSeenRelative(daysAgo(7), NOW)).toBe('For en uge siden');
    expect(lastSeenRelative(daysAgo(10), NOW)).toBe('For en uge siden');
    expect(lastSeenRelative(daysAgo(13.9), NOW)).toBe('For en uge siden');
  });

  it('returns "For {n} uger siden" for 14–30 days ago', () => {
    expect(lastSeenRelative(daysAgo(14), NOW)).toBe('For 2 uger siden');
    expect(lastSeenRelative(daysAgo(21), NOW)).toBe('For 3 uger siden');
    expect(lastSeenRelative(daysAgo(29), NOW)).toBe('For 4 uger siden');
  });

  it('returns "For en måned siden" for 30–60 days ago', () => {
    expect(lastSeenRelative(daysAgo(30), NOW)).toBe('For en måned siden');
    expect(lastSeenRelative(daysAgo(45), NOW)).toBe('For en måned siden');
    expect(lastSeenRelative(daysAgo(59), NOW)).toBe('For en måned siden');
  });

  it('returns "For længe siden" for > 60 days ago', () => {
    expect(lastSeenRelative(daysAgo(60), NOW)).toBe('For længe siden');
    expect(lastSeenRelative(daysAgo(365), NOW)).toBe('For længe siden');
  });
});
