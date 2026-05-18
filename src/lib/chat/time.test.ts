import { describe, it, expect } from 'vitest';
import {
  relTime,
  clockTime,
  daySeparator,
  receiptTime,
  groupMessages,
  type GroupableMessage,
} from './time';

// Tuesday 2026-05-12 14:32:00 local time — same reference as the design's ChatData.jsx.
const NOW = new Date('2026-05-12T14:32:00');

function minutesAgo(min: number): Date {
  return new Date(NOW.getTime() - min * 60_000);
}

describe('relTime', () => {
  it('returns "nu" when the message is less than a minute old', () => {
    expect(relTime(minutesAgo(0), NOW)).toBe('nu');
    expect(relTime(minutesAgo(0.5), NOW)).toBe('nu');
  });

  it('returns "X min" when 1–59 minutes old', () => {
    expect(relTime(minutesAgo(1), NOW)).toBe('1 min');
    expect(relTime(minutesAgo(5), NOW)).toBe('5 min');
    expect(relTime(minutesAgo(59), NOW)).toBe('59 min');
  });

  it('returns "X t" when at least 1 hour but less than 24h on the same day', () => {
    expect(relTime(minutesAgo(60), NOW)).toBe('1 t');
    expect(relTime(minutesAgo(60 * 13), NOW)).toBe('13 t');
  });

  it('returns "i går" for yesterday', () => {
    const yesterday = new Date('2026-05-11T10:00:00');
    expect(relTime(yesterday, NOW)).toBe('i går');
  });

  it('returns short weekday for 2–6 days ago', () => {
    // 2026-05-12 is a Tuesday → 2 days ago is Sunday → "søn."
    const twoDaysAgo = new Date('2026-05-10T10:00:00');
    expect(relTime(twoDaysAgo, NOW)).toBe('søn.');
  });

  it('returns DD/M for ≥ 7 days ago', () => {
    const longAgo = new Date('2026-04-03T10:00:00');
    expect(relTime(longAgo, NOW)).toBe('3/4');
  });
});

describe('clockTime', () => {
  it('formats as HH:MM with leading zeros', () => {
    expect(clockTime(new Date('2026-05-12T09:05:00'))).toBe('09:05');
    expect(clockTime(new Date('2026-05-12T14:32:00'))).toBe('14:32');
    expect(clockTime(new Date('2026-05-12T00:00:00'))).toBe('00:00');
  });
});

describe('daySeparator', () => {
  it('returns "I dag" for today', () => {
    expect(daySeparator(new Date('2026-05-12T08:00:00'), NOW)).toBe('I dag');
  });

  it('returns "I går" for yesterday', () => {
    expect(daySeparator(new Date('2026-05-11T08:00:00'), NOW)).toBe('I går');
  });

  it('returns Danish weekday for 2–6 days ago', () => {
    // 2026-05-10 is a Sunday
    expect(daySeparator(new Date('2026-05-10T08:00:00'), NOW)).toBe('Søndag');
    // 2026-05-08 is a Friday
    expect(daySeparator(new Date('2026-05-08T08:00:00'), NOW)).toBe('Fredag');
  });

  it('returns "D. month" for ≥ 7 days ago', () => {
    expect(daySeparator(new Date('2026-05-01T08:00:00'), NOW)).toBe('1. maj');
    expect(daySeparator(new Date('2026-04-03T08:00:00'), NOW)).toBe('3. apr.');
  });
});

describe('receiptTime', () => {
  it('returns just the clock for today', () => {
    expect(receiptTime(new Date('2026-05-12T14:32:00'), NOW)).toBe('14:32');
  });

  it('prefixes the separator for non-today dates', () => {
    expect(receiptTime(new Date('2026-05-11T18:04:00'), NOW)).toBe('I går · 18:04');
  });
});

describe('groupMessages', () => {
  function makeMsg(id: string, authorId: string, sentAt: Date): GroupableMessage {
    return { id, author_id: authorId, sent_at: sentAt };
  }

  it('returns [] for no messages', () => {
    expect(groupMessages([])).toEqual([]);
  });

  it('groups consecutive same-author messages within 3 minutes', () => {
    const msgs = [
      makeMsg('a', 'mikkel', new Date('2026-05-12T14:00:00')),
      makeMsg('b', 'mikkel', new Date('2026-05-12T14:01:00')),
      makeMsg('c', 'mikkel', new Date('2026-05-12T14:02:30')),
    ];
    const groups = groupMessages(msgs);
    expect(groups).toHaveLength(1);
    expect(groups[0].author_id).toBe('mikkel');
    expect(groups[0].messages).toHaveLength(3);
  });

  it('splits when the same author waits > 3 minutes', () => {
    const msgs = [
      makeMsg('a', 'mikkel', new Date('2026-05-12T14:00:00')),
      makeMsg('b', 'mikkel', new Date('2026-05-12T14:04:00')),
    ];
    const groups = groupMessages(msgs);
    expect(groups).toHaveLength(2);
  });

  it('splits when the author changes', () => {
    const msgs = [
      makeMsg('a', 'mikkel', new Date('2026-05-12T14:00:00')),
      makeMsg('b', 'viggo', new Date('2026-05-12T14:00:30')),
      makeMsg('c', 'mikkel', new Date('2026-05-12T14:01:00')),
    ];
    const groups = groupMessages(msgs);
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.author_id)).toEqual(['mikkel', 'viggo', 'mikkel']);
  });

  it('splits across day boundaries even within 3 minutes', () => {
    const msgs = [
      makeMsg('a', 'mikkel', new Date('2026-05-11T23:59:30')),
      makeMsg('b', 'mikkel', new Date('2026-05-12T00:01:00')),
    ];
    const groups = groupMessages(msgs);
    expect(groups).toHaveLength(2);
  });
});
