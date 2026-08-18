// Types for the ScrapedDuck feed (https://github.com/bigfoott/ScrapedDuck),
// which scrapes LeekDuck.com with permission and republishes it as JSON.
//
// IMPORTANT — the data lives on a separate `data` BRANCH, not under `data/` on
// the default branch. The obvious-looking .../main/data/events.json 404s.
//
// Licence terms we have to honour (ScrapedDuck README): no paywall, no ads, and
// credit both ScrapedDuck and LeekDuck. The attribution lives in the #events
// channel description (src/lib/chat/channels.ts) and on rotation posts.

export const EVENTS_URL =
  'https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json';
export const RAIDS_URL =
  'https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/raids.json';

/**
 * Event types the bot announces.
 *
 * Deliberately raids-only: these are the events people physically gather for,
 * which is what the app is for. `community-day` is knowingly excluded — widen
 * this list (and the test that pins it) if that changes.
 *
 * The feed carries ~14 types in total; the rest (go-battle-league, go-pass,
 * season, research, …) are solo or always-on and would be steady noise.
 */
export const POSTABLE_EVENT_TYPES = [
  'raid-day',
  'raid-hour',
  'raid-battles',
  'elite-raids',
] as const;

export type PostableEventType = (typeof POSTABLE_EVENT_TYPES)[number];

/**
 * A single event from events.json.
 *
 * `start` / `end` are nullable AND carry two different meanings — see
 * `formatEventWindow` in ./format.ts before doing anything with them.
 */
export interface ScrapedDuckEvent {
  eventID: string;
  name: string;
  eventType: string;
  heading: string;
  link: string;
  image: string;
  start: string | null;
  end: string | null;
  extraData: unknown;
}

/**
 * A raid boss from raids.json.
 *
 * Note there is NO id field — `name` + `tier` is the only stable identity, which
 * is why the rotation is diffed by fingerprint rather than by key.
 *
 * `tier` is an opaque label. The ScrapedDuck wiki documents values like
 * "Tier 3" but live data returns "3-Star Raids"; the format has already drifted
 * once, so never parse it for meaning.
 */
export interface ScrapedDuckRaidBoss {
  name: string;
  tier: string;
  canBeShiny: boolean;
  image: string;
}

/**
 * Result of a feed fetch. A discriminated union rather than a throw, so one bad
 * poll degrades to "skip this run" instead of taking down the whole route.
 *
 * `unchanged` is the 304 case — we send If-None-Match, and raw.githubusercontent
 * caches for 5 minutes, so a 20-minute poll hits this regularly.
 */
export type FeedResult<T> =
  | { status: 'ok'; data: T; etag: string | null }
  | { status: 'unchanged' }
  | { status: 'error'; reason: string };

/** Keys used in the `pogo_feed_state` table. */
export const STATE_KEY_RAID_FINGERPRINT = 'raid_lineup_fingerprint';
// Only the raids feed uses a conditional GET — see the comment in run.ts for why
// the events poll deliberately does not.
export const STATE_KEY_RAIDS_ETAG = 'raids_etag';
