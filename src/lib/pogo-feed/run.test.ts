import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScrapedDuckEvent, ScrapedDuckRaidBoss } from './types';

// Mock the three I/O edges. The point of this file is the orchestration —
// ordering, dedupe and failure handling — not the modules it calls.
vi.mock('./feed', () => ({
  fetchEvents: vi.fn(),
  fetchRaidBosses: vi.fn(),
}));

vi.mock('./state', () => ({
  getState: vi.fn(),
  setState: vi.fn(),
  getPostedEventIds: vi.fn(),
  markEventsPosted: vi.fn(),
}));

vi.mock('./post', () => ({
  postAsBot: vi.fn(),
  isBotConfigured: vi.fn(() => true),
}));

import { runFeedPoll } from './run';
import { fetchEvents, fetchRaidBosses } from './feed';
import { getState, setState, getPostedEventIds, markEventsPosted } from './state';
import { postAsBot } from './post';

const NOW = new Date('2026-08-16T10:00:00.000Z');

function event(id: string, overrides: Partial<ScrapedDuckEvent> = {}): ScrapedDuckEvent {
  return {
    eventID: id,
    name: `Event ${id}`,
    eventType: 'raid-hour',
    heading: 'Raid Hour',
    link: `https://leekduck.com/events/${id}/`,
    image: '',
    start: '2026-08-17T18:00:00.000',
    end: '2026-08-17T19:00:00.000',
    extraData: null,
    ...overrides,
  };
}

const BOSSES: ScrapedDuckRaidBoss[] = [
  { name: 'Groudon', tier: '5-Star Raids', canBeShiny: true, image: '' },
];

/** Default happy-path wiring; individual tests override what they care about. */
function setup(options: {
  events?: ScrapedDuckEvent[];
  bosses?: ScrapedDuckRaidBoss[];
  postedIds?: string[];
  raidFingerprint?: string | null;
} = {}) {
  vi.mocked(fetchEvents).mockResolvedValue({
    status: 'ok',
    data: options.events ?? [],
    etag: '"events-etag"',
  });
  vi.mocked(fetchRaidBosses).mockResolvedValue({
    status: 'ok',
    data: options.bosses ?? BOSSES,
    etag: '"raids-etag"',
  });
  vi.mocked(getPostedEventIds).mockResolvedValue(new Set(options.postedIds ?? ['seed']));
  vi.mocked(getState).mockImplementation(async (key: string) =>
    key === 'raid_lineup_fingerprint' ? (options.raidFingerprint ?? null) : null
  );
  vi.mocked(markEventsPosted).mockResolvedValue({ error: null });
  vi.mocked(setState).mockResolvedValue(undefined);
  vi.mocked(postAsBot).mockResolvedValue({ error: null });
}

/** Bodies of every message the bot posted, in order. */
function postedBodies(): string[] {
  return vi.mocked(postAsBot).mock.calls.map((call) => call[1]);
}

describe('runFeedPoll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('posts a new event to #events', async () => {
    setup({ events: [event('fresh')], raidFingerprint: 'unchanged' });
    vi.mocked(fetchRaidBosses).mockResolvedValue({ status: 'unchanged' });

    const summary = await runFeedPoll(NOW);

    expect(summary.eventsPosted).toBe(1);
    expect(vi.mocked(postAsBot).mock.calls[0][0]).toBe('events');
    expect(postedBodies()[0]).toContain('Event fresh');
  });

  it('records an event BEFORE posting it', async () => {
    // Ordering matters: if the post succeeds but the ledger write hasn't
    // happened, a crash would repeat the message on the next poll.
    setup({ events: [event('fresh')] });
    const order: string[] = [];
    vi.mocked(markEventsPosted).mockImplementation(async () => {
      order.push('mark');
      return { error: null };
    });
    vi.mocked(postAsBot).mockImplementation(async () => {
      order.push('post');
      return { error: null };
    });

    await runFeedPoll(NOW);

    expect(order.indexOf('mark')).toBeLessThan(order.indexOf('post'));
  });

  it('does not post when the event has already been recorded', async () => {
    setup({ events: [event('known')], postedIds: ['known'] });
    vi.mocked(fetchRaidBosses).mockResolvedValue({ status: 'unchanged' });

    const summary = await runFeedPoll(NOW);

    expect(summary.eventsPosted).toBe(0);
    expect(postAsBot).not.toHaveBeenCalled();
  });

  it('posts nothing on a cold start, but records the whole feed', async () => {
    setup({
      events: [event('a'), event('b'), event('c')],
      postedIds: [],
      raidFingerprint: 'unchanged-lineup',
    });
    vi.mocked(fetchRaidBosses).mockResolvedValue({ status: 'unchanged' });

    const summary = await runFeedPoll(NOW);

    expect(summary.eventsPosted).toBe(0);
    expect(summary.seeded).toBe(3);
    expect(summary.notes).toContain('seeded_on_first_run');
    expect(postAsBot).not.toHaveBeenCalled();
  });

  it('skips the events half cleanly when that feed is down', async () => {
    setup({ events: [event('fresh')] });
    vi.mocked(fetchEvents).mockResolvedValue({ status: 'error', reason: 'http_500' });

    const summary = await runFeedPoll(NOW);

    expect(summary.eventsPosted).toBe(0);
    expect(summary.notes).toContain('events_http_500');
    // The raid half is independent and must still run.
    expect(summary.rotationPosted).toBe(true);
  });

  it('does nothing at all when both feeds are unchanged', async () => {
    setup();
    vi.mocked(fetchEvents).mockResolvedValue({ status: 'unchanged' });
    vi.mocked(fetchRaidBosses).mockResolvedValue({ status: 'unchanged' });

    const summary = await runFeedPoll(NOW);

    expect(postAsBot).not.toHaveBeenCalled();
    expect(summary.notes).toEqual(
      expect.arrayContaining(['events_unchanged', 'raids_unchanged'])
    );
  });

  it('does not send a conditional GET for events', async () => {
    // Regression: the 5-post cap leaves work pending while the feed itself is
    // unchanged. With If-None-Match the next run would 304 and skip, stranding
    // the overflow until the feed content changed — which can be days, because
    // GitHub's ETag is a content hash.
    setup({ events: [event('a')] });
    vi.mocked(fetchRaidBosses).mockResolvedValue({ status: 'unchanged' });

    await runFeedPoll(NOW);

    expect(fetchEvents).toHaveBeenCalledWith();
  });

  it('drains the overflow on the following run', async () => {
    const feed = Array.from({ length: 7 }, (_, i) =>
      event(`e${i}`, { start: `2026-08-1${(i % 3) + 7}T18:00:00.000` })
    );
    const ledger = new Set<string>(['seed']);

    setup({ events: feed });
    vi.mocked(fetchRaidBosses).mockResolvedValue({ status: 'unchanged' });
    vi.mocked(getPostedEventIds).mockImplementation(async () => new Set(ledger));
    vi.mocked(markEventsPosted).mockImplementation(async (rows) => {
      for (const row of rows) ledger.add(row.eventID);
      return { error: null };
    });

    const first = await runFeedPoll(NOW);
    expect(first.eventsPosted).toBe(5);

    const second = await runFeedPoll(NOW);
    expect(second.eventsPosted).toBe(2);

    // Seven distinct events, no repeats.
    const bodies = postedBodies();
    expect(bodies).toHaveLength(7);
    expect(new Set(bodies).size).toBe(7);
  });

  it('posts the rotation when the lineup fingerprint changes', async () => {
    setup({ raidFingerprint: 'something-else' });
    vi.mocked(fetchEvents).mockResolvedValue({ status: 'unchanged' });

    const summary = await runFeedPoll(NOW);

    expect(summary.rotationPosted).toBe(true);
    expect(postedBodies()[0]).toContain('Raid-bosserne er skiftet');
  });

  it('does not repost the rotation when the lineup is identical', async () => {
    // Fingerprint of BOSSES, as diff.ts computes it.
    setup({ raidFingerprint: '5-Star Raids|Groudon|s' });
    vi.mocked(fetchEvents).mockResolvedValue({ status: 'unchanged' });

    const summary = await runFeedPoll(NOW);

    expect(summary.rotationPosted).toBe(false);
    expect(postAsBot).not.toHaveBeenCalled();
  });

  it('ignores an empty raid lineup rather than posting a blank rotation', async () => {
    // An empty array means a bad scrape upstream, not "no raids today".
    setup({ bosses: [] });
    vi.mocked(fetchEvents).mockResolvedValue({ status: 'unchanged' });

    const summary = await runFeedPoll(NOW);

    expect(summary.rotationPosted).toBe(false);
    expect(summary.notes).toContain('raids_empty');
    expect(setState).not.toHaveBeenCalledWith('raid_lineup_fingerprint', expect.anything());
  });

  it('does not count a failed post as posted', async () => {
    setup({ events: [event('fresh')] });
    vi.mocked(fetchRaidBosses).mockResolvedValue({ status: 'unchanged' });
    vi.mocked(postAsBot).mockResolvedValue({ error: 'boom' });

    const summary = await runFeedPoll(NOW);

    expect(summary.eventsPosted).toBe(0);
    expect(summary.notes).toContain('post_failed_fresh');
  });

  it('skips an event whose ledger write failed, rather than risking a repeat', async () => {
    setup({ events: [event('fresh')] });
    vi.mocked(fetchRaidBosses).mockResolvedValue({ status: 'unchanged' });
    vi.mocked(markEventsPosted).mockResolvedValue({ error: 'db down' });

    const summary = await runFeedPoll(NOW);

    expect(postAsBot).not.toHaveBeenCalled();
    expect(summary.notes).toContain('skip_fresh_unrecorded');
  });
});
