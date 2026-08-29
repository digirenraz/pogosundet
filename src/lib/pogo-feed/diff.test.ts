import { describe, it, expect } from 'vitest';
import {
  selectNewEvents,
  diffRaidLineup,
  raidLineupFingerprint,
  isAnnounceable,
  isPostableRaidTier,
  MAX_POSTS_PER_RUN,
  MAX_LEAD_DAYS,
} from './diff';
import type { ScrapedDuckEvent, ScrapedDuckRaidBoss } from './types';

// Fixed "now" so the lead-time maths is deterministic.
const NOW = Date.parse('2026-08-16T12:00:00+02:00');

const DAY = 24 * 60 * 60 * 1000;

function event(overrides: Partial<ScrapedDuckEvent> & { eventID: string }): ScrapedDuckEvent {
  return {
    name: 'Test Raid Hour',
    eventType: 'raid-hour',
    heading: 'Raid Hour',
    link: 'https://leekduck.com/events/test/',
    image: '',
    start: '2026-08-17T18:00:00.000',
    end: '2026-08-17T19:00:00.000',
    extraData: null,
    ...overrides,
  };
}

/** Format an offset-from-now as a naive feed timestamp. */
function naive(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString().replace(/\.\d{3}Z$/, '.000');
}

function boss(name: string, tier: string, canBeShiny = false): ScrapedDuckRaidBoss {
  return { name, tier, canBeShiny, image: '' };
}

describe('isAnnounceable', () => {
  it('accepts the raid event types the bot posts', () => {
    for (const eventType of ['raid-day', 'raid-hour', 'raid-battles', 'elite-raids']) {
      expect(isAnnounceable(event({ eventID: 'e', eventType }), NOW)).toBe(true);
    }
  });

  it('rejects non-raid event types', () => {
    // community-day is deliberately excluded — see POSTABLE_EVENT_TYPES.
    for (const eventType of ['community-day', 'go-battle-league', 'season', 'go-pass']) {
      expect(isAnnounceable(event({ eventID: 'e', eventType }), NOW)).toBe(false);
    }
  });

  it('rejects an event that has already ended', () => {
    const ended = event({
      eventID: 'past',
      start: naive(-2 * DAY),
      end: naive(-1 * DAY),
    });
    expect(isAnnounceable(ended, NOW)).toBe(false);
  });

  it(`rejects an event starting more than ${MAX_LEAD_DAYS} days out`, () => {
    const far = event({
      eventID: 'far',
      start: naive((MAX_LEAD_DAYS + 5) * DAY),
      end: naive((MAX_LEAD_DAYS + 5) * DAY + 3600_000),
    });
    expect(isAnnounceable(far, NOW)).toBe(false);
  });

  it('accepts an event with no dates at all', () => {
    // The feed does this for open-ended entries; the formatter drops the line.
    expect(isAnnounceable(event({ eventID: 'x', start: null, end: null }), NOW)).toBe(true);
  });
});

describe('selectNewEvents', () => {
  it('seeds silently on the first run and posts nothing', () => {
    // The regression this guards: an empty ledger + a ~40-event feed would
    // otherwise dump the whole LeekDuck calendar into chat at once.
    const feed = [event({ eventID: 'a' }), event({ eventID: 'b' }), event({ eventID: 'c' })];

    const result = selectNewEvents(feed, new Set(), NOW, false);

    expect(result.seeding).toBe(true);
    expect(result.toPost).toEqual([]);
    expect(result.toSeedOnly).toEqual(['a', 'b', 'c']);
  });

  it('posts an event that has not been seen before', () => {
    const feed = [event({ eventID: 'known' }), event({ eventID: 'fresh' })];

    const result = selectNewEvents(feed, new Set(['known']), NOW, true);

    expect(result.seeding).toBe(false);
    expect(result.toPost.map((e) => e.eventID)).toEqual(['fresh']);
  });

  it('posts nothing when the feed has not changed', () => {
    const feed = [event({ eventID: 'a' }), event({ eventID: 'b' })];
    const seen = new Set(['a', 'b']);

    const result = selectNewEvents(feed, seen, NOW, true);

    expect(result.toPost).toEqual([]);
    expect(result.toSeedOnly).toEqual([]);
  });

  it('never re-posts an event across repeated polls', () => {
    const feed = [event({ eventID: 'a' })];
    const seen = new Set(['seed']);

    const first = selectNewEvents(feed, seen, NOW, true);
    expect(first.toPost.map((e) => e.eventID)).toEqual(['a']);

    // Simulate the ledger write the runner performs, then poll again.
    for (const e of first.toPost) seen.add(e.eventID);
    const second = selectNewEvents(feed, seen, NOW, true);

    expect(second.toPost).toEqual([]);
  });

  it('records permanently-uninteresting events so they are not re-evaluated forever', () => {
    // Wrong type and already-ended can never become announceable, so recording
    // them is safe and stops them being re-checked every 20 minutes.
    const feed = [
      event({ eventID: 'wrong-type', eventType: 'community-day' }),
      event({ eventID: 'ended', start: naive(-2 * DAY), end: naive(-1 * DAY) }),
    ];

    const result = selectNewEvents(feed, new Set(['seed']), NOW, true);

    expect(result.toPost).toEqual([]);
    expect(result.toSeedOnly.sort()).toEqual(['ended', 'wrong-type']);
  });

  it('does NOT record an event that is merely too far out', () => {
    // Regression: recording it would mark it handled forever, so when its date
    // finally came within the window it would be filtered out as "already seen"
    // and could never post. The feed really does carry raid days two months out.
    const feed = [
      event({
        eventID: 'far-future-raid-day',
        eventType: 'raid-day',
        start: naive(60 * DAY),
        end: naive(60 * DAY + 6 * 3600_000),
      }),
    ];

    const result = selectNewEvents(feed, new Set(['seed']), NOW, true);

    expect(result.toPost).toEqual([]);
    expect(result.toSeedOnly).toEqual([]);
  });

  it('announces a far-future event once its date comes within range', () => {
    const far = event({
      eventID: 'raid-day-later',
      eventType: 'raid-day',
      start: naive(60 * DAY),
      end: naive(60 * DAY + 6 * 3600_000),
    });
    const ledger = new Set(['seed']);

    // Poll today: too far out, nothing posted, nothing recorded.
    const first = selectNewEvents([far], ledger, NOW, true);
    expect(first.toPost).toEqual([]);
    for (const id of first.toSeedOnly) ledger.add(id);

    // Poll again 45 days later: now inside the 30-day window.
    const second = selectNewEvents([far], ledger, NOW + 45 * DAY, true);
    expect(second.toPost.map((e) => e.eventID)).toEqual(['raid-day-later']);
  });

  it(`caps a burst at ${MAX_POSTS_PER_RUN} posts and leaves the rest for next run`, () => {
    const feed = Array.from({ length: 9 }, (_, i) =>
      event({ eventID: `e${i}`, start: naive((i + 1) * 3600_000) })
    );

    const result = selectNewEvents(feed, new Set(['seed']), NOW, true);

    expect(result.toPost).toHaveLength(MAX_POSTS_PER_RUN);
    // The overflow must NOT be seeded — otherwise it would be silently swallowed
    // and never announced.
    expect(result.toSeedOnly).toEqual([]);
  });

  it('posts the soonest events first', () => {
    const feed = [
      event({ eventID: 'later', start: naive(5 * DAY) }),
      event({ eventID: 'sooner', start: naive(1 * DAY) }),
    ];

    const result = selectNewEvents(feed, new Set(['seed']), NOW, true);

    expect(result.toPost.map((e) => e.eventID)).toEqual(['sooner', 'later']);
  });
});

describe('isPostableRaidTier', () => {
  it('allows 5-star and mega raids', () => {
    expect(isPostableRaidTier(boss('Groudon', '5-Star Raids'))).toBe(true);
    expect(isPostableRaidTier(boss('Mega Garchomp', 'Mega Raids'))).toBe(true);
  });

  it('excludes lower tiers', () => {
    expect(isPostableRaidTier(boss('Tirtouga', '1-Star Raids'))).toBe(false);
    expect(isPostableRaidTier(boss('Poliwrath', '3-Star Raids'))).toBe(false);
    expect(isPostableRaidTier(boss('Giratina', 'Shadow Raids'))).toBe(false);
  });

  it('excludes an unrecognised tier rather than guessing', () => {
    expect(isPostableRaidTier(boss('Mystery', 'Some New Tier'))).toBe(false);
  });
});

describe('raidLineupFingerprint', () => {
  it('is independent of feed ordering', () => {
    // The feed reorders entries between scrapes; that must not read as a change.
    const a = [boss('Groudon', '5-Star Raids'), boss('Tirtouga', '1-Star Raids')];
    const b = [boss('Tirtouga', '1-Star Raids'), boss('Groudon', '5-Star Raids')];

    expect(raidLineupFingerprint(a)).toBe(raidLineupFingerprint(b));
  });

  it('changes when shiny eligibility changes', () => {
    const before = [boss('Groudon', '5-Star Raids', false)];
    const after = [boss('Groudon', '5-Star Raids', true)];

    expect(raidLineupFingerprint(before)).not.toBe(raidLineupFingerprint(after));
  });

  it('distinguishes the same boss in different tiers', () => {
    expect(raidLineupFingerprint([boss('Groudon', '5-Star Raids')])).not.toBe(
      raidLineupFingerprint([boss('Groudon', 'Mega Raids')])
    );
  });
});

describe('diffRaidLineup', () => {
  it('treats the first ever run as a change', () => {
    const bosses = [boss('Groudon', '5-Star Raids')];

    const diff = diffRaidLineup(bosses, null);

    expect(diff.changed).toBe(true);
    expect(diff.added).toHaveLength(1);
  });

  it('reports no change for an identical lineup', () => {
    const bosses = [boss('Groudon', '5-Star Raids'), boss('Kyogre', '5-Star Raids')];
    const fingerprint = raidLineupFingerprint(bosses);

    const diff = diffRaidLineup(bosses, fingerprint);

    expect(diff.changed).toBe(false);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it('reports no change when only the order differs', () => {
    const before = [boss('Groudon', '5-Star Raids'), boss('Kyogre', '5-Star Raids')];
    const after = [boss('Kyogre', '5-Star Raids'), boss('Groudon', '5-Star Raids')];

    expect(diffRaidLineup(after, raidLineupFingerprint(before)).changed).toBe(false);
  });

  it('detects an added and a removed boss', () => {
    const before = [boss('Groudon', '5-Star Raids')];
    const after = [boss('Kyogre', '5-Star Raids')];

    const diff = diffRaidLineup(after, raidLineupFingerprint(before));

    expect(diff.changed).toBe(true);
    expect(diff.added.map((b) => b.name)).toEqual(['Kyogre']);
    expect(diff.removed).toEqual(['5-Star Raids|Groudon']);
  });

  it('handles an unrecognised tier label without dropping the boss', () => {
    // The wiki documents "Tier 3" while live data says "3-Star Raids" — the
    // labels have drifted once already, so a new one must not break the diff.
    const diff = diffRaidLineup([boss('Mystery', 'Some New Tier')], null);

    expect(diff.changed).toBe(true);
    expect(diff.added.map((b) => b.name)).toEqual(['Mystery']);
  });
});
