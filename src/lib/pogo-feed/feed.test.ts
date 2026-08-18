import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchEvents, fetchRaidBosses } from './feed';

// The failure paths matter more than the happy path here: the cron runs
// unattended every 20 minutes, so a feed outage must degrade to "skip this run"
// rather than throwing and taking the whole route down.

const fetchMock = vi.fn();

function jsonResponse(body: unknown, init: { status?: number; etag?: string } = {}) {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    json: async () => body,
    headers: new Headers(init.etag ? { etag: init.etag } : {}),
  };
}

describe('fetchEvents / fetchRaidBosses', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    // Silence the deliberate console.error calls in the failure paths.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('parses a well-formed events payload', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        [
          {
            eventID: 'august-raidhour',
            name: 'Kyogre Raid Hour',
            eventType: 'raid-hour',
            heading: 'Raid Hour',
            link: 'https://leekduck.com/events/august-raidhour/',
            image: 'https://cdn.leekduck.com/x.jpg',
            start: '2026-08-19T18:00:00.000',
            end: '2026-08-19T19:00:00.000',
            extraData: null,
          },
        ],
        { etag: '"abc"' }
      )
    );

    const result = await fetchEvents();

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].eventID).toBe('august-raidhour');
    expect(result.etag).toBe('"abc"');
  });

  it('sends If-None-Match when it has an etag, and handles 304', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 304, json: async () => null, headers: new Headers() });

    const result = await fetchEvents('"cached"');

    expect(result.status).toBe('unchanged');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('events.json'),
      expect.objectContaining({ headers: { 'If-None-Match': '"cached"' } })
    );
  });

  it('returns an error result on a 500 instead of throwing', async () => {
    fetchMock.mockResolvedValue(jsonResponse(null, { status: 500 }));

    const result = await fetchEvents();

    expect(result).toEqual({ status: 'error', reason: 'http_500' });
  });

  it('returns an error result when the network rejects', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await fetchEvents();

    expect(result.status).toBe('error');
  });

  it('returns an error result when the request times out', async () => {
    const timeout = new Error('The operation was aborted');
    timeout.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeout);

    const result = await fetchRaidBosses();

    expect(result).toEqual({ status: 'error', reason: 'TimeoutError' });
  });

  it('returns an error result on malformed JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
      headers: new Headers(),
    });

    const result = await fetchEvents();

    expect(result).toEqual({ status: 'error', reason: 'malformed_json' });
  });

  it('returns an error result when the payload is not an array', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Not Found' }));

    const result = await fetchEvents();

    expect(result).toEqual({ status: 'error', reason: 'unexpected_shape' });
  });

  it('drops individual malformed entries rather than failing the whole feed', async () => {
    // ScrapedDuck occasionally ships a partially-scraped entry; one bad row
    // should not stall the bot.
    fetchMock.mockResolvedValue(
      jsonResponse([
        { eventID: 'good', name: 'Raid Hour', eventType: 'raid-hour' },
        { name: 'missing an id', eventType: 'raid-hour' },
        { eventID: '', name: 'empty id', eventType: 'raid-hour' },
      ])
    );

    const result = await fetchEvents();

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.map((e) => e.eventID)).toEqual(['good']);
  });

  it('coerces missing optional raid-boss fields to safe defaults', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([{ name: 'Groudon', tier: '5-Star Raids' }])
    );

    const result = await fetchRaidBosses();

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data[0]).toEqual({
      name: 'Groudon',
      tier: '5-Star Raids',
      canBeShiny: false,
      image: '',
    });
  });
});
