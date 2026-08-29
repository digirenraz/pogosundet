import { describe, it, expect } from 'vitest';
import {
  parseFeedTimestamp,
  formatEventWindow,
  formatEventMessage,
  formatRaidRotationMessage,
  truncate,
} from './format';
import type { ScrapedDuckEvent, ScrapedDuckRaidBoss } from './types';
import { CHAT_MESSAGE_MAX_LENGTH } from '@/lib/chat/types';

// 16 August 2026, 12:00 Danish time (summer, UTC+2).
const NOW = new Date('2026-08-16T10:00:00.000Z');

function event(overrides: Partial<ScrapedDuckEvent> = {}): ScrapedDuckEvent {
  return {
    eventID: 'e',
    name: 'Kyogre Raid Hour',
    eventType: 'raid-hour',
    heading: 'Raid Hour',
    link: 'https://leekduck.com/events/kyogre/',
    image: '',
    start: '2026-08-16T18:00:00.000',
    end: '2026-08-16T19:00:00.000',
    extraData: null,
    ...overrides,
  };
}

function boss(name: string, tier: string, canBeShiny = false): ScrapedDuckRaidBoss {
  return { name, tier, canBeShiny, image: '' };
}

describe('parseFeedTimestamp', () => {
  it('reads a naive timestamp digit-for-digit as local wall-clock', () => {
    // "18:00" means 18:00 for every player on earth. If this ever returns 20:00
    // it means the string was handed to `new Date()` and parsed as UTC.
    expect(parseFeedTimestamp('2026-08-16T18:00:00.000')).toEqual({
      year: 2026,
      month: 8,
      day: 16,
      hour: 18,
      minute: 0,
    });
  });

  it('converts a Z-suffixed timestamp into Copenhagen time', () => {
    // 16:00Z in August is 18:00 in Denmark (UTC+2).
    expect(parseFeedTimestamp('2026-08-28T16:00:00.000Z')).toEqual({
      year: 2026,
      month: 8,
      day: 28,
      hour: 18,
      minute: 0,
    });
  });

  it('applies winter time to a Z-suffixed timestamp', () => {
    // 16:00Z in December is 17:00 in Denmark (UTC+1).
    expect(parseFeedTimestamp('2026-12-05T16:00:00.000Z')).toMatchObject({
      hour: 17,
      day: 5,
    });
  });

  it('returns null for null and for junk', () => {
    expect(parseFeedTimestamp(null)).toBeNull();
    expect(parseFeedTimestamp('not a date')).toBeNull();
  });
});

describe('formatEventWindow', () => {
  it('says "I dag" with a time range for a same-day event', () => {
    expect(formatEventWindow('2026-08-16T18:00:00.000', '2026-08-16T19:00:00.000', NOW)).toBe(
      'I dag 18:00–19:00'
    );
  });

  it('says "I morgen" for tomorrow', () => {
    expect(formatEventWindow('2026-08-17T18:00:00.000', '2026-08-17T19:00:00.000', NOW)).toBe(
      'I morgen 18:00–19:00'
    );
  });

  it('names the weekday within the coming week', () => {
    // 19 August 2026 is a Wednesday.
    expect(formatEventWindow('2026-08-19T18:00:00.000', '2026-08-19T19:00:00.000', NOW)).toBe(
      'Onsdag 18:00–19:00'
    );
  });

  it('uses a date beyond a week out', () => {
    expect(formatEventWindow('2026-09-05T10:00:00.000', '2026-09-05T18:00:00.000', NOW)).toBe(
      '5. sep. 10:00–18:00'
    );
  });

  it('spans two days when the event crosses midnight', () => {
    const result = formatEventWindow('2026-08-16T22:00:00.000', '2026-08-17T02:00:00.000', NOW);
    expect(result).toBe('I dag 22:00 – i morgen 02:00');
  });

  it('leads with the end time for an event that is already running', () => {
    // A multi-day raid rotation that started last week: "started 12 August" is
    // stale news, "ends Tuesday" is the useful part.
    const result = formatEventWindow('2026-08-12T06:00:00.000', '2026-08-18T22:00:00.000', NOW);

    expect(result).toBe('Slutter tirsdag 22:00');
  });

  it('does not mix an absolute date with a relative weekday in one range', () => {
    // Regression: this produced "19. aug. 06:00 – tirsdag 22:00" — two different
    // registers either side of the dash.
    const result = formatEventWindow('2026-08-19T06:00:00.000', '2026-08-25T22:00:00.000', NOW);

    expect(result).toBe('19. aug. 06:00 – 25. aug. 22:00');
    expect(result).not.toMatch(/onsdag|tirsdag|i dag|i morgen/);
  });

  it('keeps both ends relative when both are within the week', () => {
    const result = formatEventWindow('2026-08-17T06:00:00.000', '2026-08-19T22:00:00.000', NOW);

    expect(result).toBe('I morgen 06:00 – onsdag 22:00');
  });

  it('does not shift a naive timestamp by the server offset', () => {
    // The regression guard: on Vercel the server clock is UTC, so a naive parse
    // would render this Danish-summer 14:00 event as 16:00.
    expect(formatEventWindow('2026-08-16T14:00:00.000', '2026-08-16T17:00:00.000', NOW)).toContain(
      '14:00'
    );
  });

  it('handles a Z-suffixed window by converting it', () => {
    expect(formatEventWindow('2026-08-16T16:00:00.000Z', '2026-08-16T17:00:00.000Z', NOW)).toBe(
      'I dag 18:00–19:00'
    );
  });

  it('returns an empty string when both dates are missing', () => {
    expect(formatEventWindow(null, null, NOW)).toBe('');
  });

  it('handles a start with no end', () => {
    expect(formatEventWindow('2026-08-16T18:00:00.000', null, NOW)).toBe('I dag 18:00');
  });
});

describe('formatEventMessage', () => {
  it('puts name, window and link on separate lines', () => {
    const message = formatEventMessage(event(), NOW);

    expect(message).toBe(
      '⏰ Kyogre Raid Hour\nI dag 18:00–19:00\nhttps://leekduck.com/events/kyogre/'
    );
  });

  it('omits the date line when the feed has no dates', () => {
    const message = formatEventMessage(event({ start: null, end: null }), NOW);

    expect(message.split('\n')).toHaveLength(2);
  });

  it('omits the link line when the feed has no link', () => {
    const message = formatEventMessage(event({ link: '' }), NOW);

    expect(message).not.toContain('http');
  });

  it('falls back to a generic emoji for an unknown event type', () => {
    const message = formatEventMessage(event({ eventType: 'brand-new-type' }), NOW);

    expect(message.startsWith('📅')).toBe(true);
  });
});

describe('formatRaidRotationMessage', () => {
  it('groups by tier in ascending order and marks shinies', () => {
    const message = formatRaidRotationMessage([
      boss('Mega Garchomp', 'Mega Raids', true),
      boss('Tirtouga', '1-Star Raids'),
      boss('Groudon', '5-Star Raids', true),
    ]);

    expect(message).toContain('🔄 Raid-bosserne er skiftet');
    // 1-Star before 5-Star before Mega.
    expect(message.indexOf('1-Star Raids')).toBeLessThan(message.indexOf('5-Star Raids'));
    expect(message.indexOf('5-Star Raids')).toBeLessThan(message.indexOf('Mega Raids'));
    expect(message).toContain('• Groudon ✨');
    expect(message).toContain('• Tirtouga');
    expect(message).not.toContain('• Tirtouga ✨');
  });

  it('credits LeekDuck and ScrapedDuck, as their terms require', () => {
    const message = formatRaidRotationMessage([boss('Groudon', '5-Star Raids')]);

    expect(message).toContain('LeekDuck.com');
    expect(message).toContain('ScrapedDuck');
  });

  it('links to the LeekDuck raid-boss page', () => {
    const message = formatRaidRotationMessage([boss('Groudon', '5-Star Raids')]);

    expect(message).toContain('https://leekduck.com/raid-bosses/');
  });

  it('sorts an unrecognised tier to the end rather than dropping it', () => {
    const message = formatRaidRotationMessage([
      boss('Mystery', 'Some New Tier'),
      boss('Groudon', '5-Star Raids'),
    ]);

    expect(message).toContain('Mystery');
    expect(message.indexOf('5-Star Raids')).toBeLessThan(message.indexOf('Some New Tier'));
  });

  it('stays within the chat message length limit for a large lineup', () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      boss(`Pokemon With A Fairly Long Name ${i}`, '5-Star Raids', true)
    );

    expect(formatRaidRotationMessage(many).length).toBeLessThanOrEqual(CHAT_MESSAGE_MAX_LENGTH);
  });
});

describe('truncate', () => {
  it('leaves a short message untouched', () => {
    expect(truncate('kort besked')).toBe('kort besked');
  });

  it('cuts on a line boundary so a list does not end mid-item', () => {
    const text = ['aaaa', 'bbbb', 'cccc'].join('\n');

    const result = truncate(text, 12);

    expect(result).toBe('aaaa\nbbbb\n…');
    expect(result.length).toBeLessThanOrEqual(12);
  });
});
