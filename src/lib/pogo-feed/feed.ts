// Fetching the ScrapedDuck feed.
//
// Every function here returns a FeedResult and NEVER throws — a feed outage,
// a GitHub blip or malformed JSON must degrade to "skip this run", not crash
// the cron route. Same principle as the bug-report route's handling of a
// GitHub API failure: log it, return a slug, carry on.
//
// Polling budget (verified against ScrapedDuck's wiki + live headers):
//   - ScrapedDuck re-scrapes LeekDuck every 10 minutes
//   - raw.githubusercontent.com sends `cache-control: max-age=300` and an ETag
//   - GitHub's rate limit is 5000 requests/hour per IP
// A 20-minute poll of two files is ~6 requests/hour. Well inside all three, and
// the conditional GET means most of those return an empty 304.

import {
  EVENTS_URL,
  RAIDS_URL,
  type FeedResult,
  type ScrapedDuckEvent,
  type ScrapedDuckRaidBoss,
} from './types';

/** Give up on a slow feed rather than holding the request open. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Shared conditional-GET wrapper.
 *
 * `parse` is responsible for validating the shape — the feed is a third party
 * and a malformed payload must not reach the formatter.
 */
async function fetchJson<T>(
  url: string,
  etag: string | null,
  parse: (raw: unknown) => T | null
): Promise<FeedResult<T>> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: etag ? { 'If-None-Match': etag } : {},
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // The whole point is to see upstream changes, so never serve from a cache.
      cache: 'no-store',
    });
  } catch (err) {
    // Network failure, DNS, or the AbortSignal timeout firing.
    const reason = err instanceof Error ? err.name : 'network_error';
    console.error(`[pogo-feed] fetch failed for ${url}: ${reason}`);
    return { status: 'error', reason };
  }

  if (response.status === 304) {
    return { status: 'unchanged' };
  }

  if (!response.ok) {
    console.error(`[pogo-feed] ${url} returned ${response.status}`);
    return { status: 'error', reason: `http_${response.status}` };
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    console.error(`[pogo-feed] ${url} returned malformed JSON`);
    return { status: 'error', reason: 'malformed_json' };
  }

  const data = parse(raw);
  if (data === null) {
    console.error(`[pogo-feed] ${url} returned an unexpected shape`);
    return { status: 'error', reason: 'unexpected_shape' };
  }

  return { status: 'ok', data, etag: response.headers.get('etag') };
}

/** True when `value` is a non-null object we can read string properties off. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Keep only entries that have the fields we actually use. A single malformed
 * entry is dropped rather than failing the whole feed — ScrapedDuck occasionally
 * ships a partially-scraped event and one bad row shouldn't stall the bot.
 */
function parseEvents(raw: unknown): ScrapedDuckEvent[] | null {
  if (!Array.isArray(raw)) return null;

  return raw.filter(isRecord).flatMap((row) => {
    if (typeof row.eventID !== 'string' || row.eventID === '') return [];
    if (typeof row.name !== 'string') return [];
    if (typeof row.eventType !== 'string') return [];

    return [
      {
        eventID: row.eventID,
        name: row.name,
        eventType: row.eventType,
        heading: typeof row.heading === 'string' ? row.heading : '',
        link: typeof row.link === 'string' ? row.link : '',
        image: typeof row.image === 'string' ? row.image : '',
        start: typeof row.start === 'string' ? row.start : null,
        end: typeof row.end === 'string' ? row.end : null,
        extraData: row.extraData ?? null,
      },
    ];
  });
}

function parseRaidBosses(raw: unknown): ScrapedDuckRaidBoss[] | null {
  if (!Array.isArray(raw)) return null;

  return raw.filter(isRecord).flatMap((row) => {
    if (typeof row.name !== 'string' || row.name === '') return [];
    if (typeof row.tier !== 'string' || row.tier === '') return [];

    return [
      {
        name: row.name,
        tier: row.tier,
        canBeShiny: row.canBeShiny === true,
        image: typeof row.image === 'string' ? row.image : '',
      },
    ];
  });
}

export function fetchEvents(
  etag: string | null = null
): Promise<FeedResult<ScrapedDuckEvent[]>> {
  return fetchJson(EVENTS_URL, etag, parseEvents);
}

export function fetchRaidBosses(
  etag: string | null = null
): Promise<FeedResult<ScrapedDuckRaidBoss[]>> {
  return fetchJson(RAIDS_URL, etag, parseRaidBosses);
}
