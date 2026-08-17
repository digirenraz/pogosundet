// Pure diffing for the event bot. No Supabase import on purpose — the whole
// "what should we post?" decision is plain functions over plain data, so it can
// be unit-tested exhaustively without mocking a database (same split as
// src/lib/players/scan-status.ts).
//
// Every anti-spam rule lives here rather than in the route, for the same reason.

import {
  POSTABLE_EVENT_TYPES,
  type ScrapedDuckEvent,
  type ScrapedDuckRaidBoss,
} from './types';

/** Never post more than this in one run, however much the feed changed. */
export const MAX_POSTS_PER_RUN = 5;

/** Events further out than this are not news yet. */
export const MAX_LEAD_DAYS = 30;

const POSTABLE = new Set<string>(POSTABLE_EVENT_TYPES);

/**
 * Parse a ScrapedDuck timestamp to an absolute instant, for comparison only.
 *
 * The feed mixes two conventions (see format.ts for the full explanation and
 * for the display path). For ordering and "has it ended?" checks, treating a
 * naive string as Danish local time is close enough — the two readings differ by
 * at most 2 hours, and every threshold here is measured in days.
 */
function toInstant(value: string | null): number | null {
  if (!value) return null;
  // A naive string gets an explicit offset so it isn't parsed as server-local
  // (which on Vercel is UTC). +02:00 is Danish summer time; the 1-hour winter
  // error is irrelevant at day granularity.
  const normalised = /[Zz]$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}+02:00`;
  const ms = Date.parse(normalised);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Is this an event the bot announces at all?
 *
 * Exported so the route can report how many were filtered by type vs by timing.
 */
export function isPostableType(event: ScrapedDuckEvent): boolean {
  return POSTABLE.has(event.eventType);
}

/**
 * Should this event be announced, ignoring whether we've seen it before?
 *
 * Drops: wrong type, already finished, and too far out to be interesting.
 * An event with no start date is allowed through — the feed does that for
 * open-ended things, and the formatter handles a missing window.
 */
export function isAnnounceable(event: ScrapedDuckEvent, now: number): boolean {
  if (!isPostableType(event)) return false;

  const end = toInstant(event.end);
  if (end !== null && end < now) return false;

  const start = toInstant(event.start);
  if (start !== null && start - now > MAX_LEAD_DAYS * 24 * 60 * 60 * 1000) {
    return false;
  }

  return true;
}

export interface EventSelection {
  /** Events to post now, soonest first, capped at MAX_POSTS_PER_RUN. */
  toPost: ScrapedDuckEvent[];
  /**
   * IDs to record as seen WITHOUT posting.
   *
   * Non-empty on the very first run (see `seeding`), and for events we filtered
   * out — recording those stops us re-evaluating them every 20 minutes forever.
   */
  toSeedOnly: string[];
  /** True when this was a cold start and nothing was posted. */
  seeding: boolean;
}

/**
 * Decide what to post from the current feed.
 *
 * The cold-start rule is the important one: on the first ever run the ledger is
 * empty and the feed holds ~40 events. Posting those would dump the entire
 * LeekDuck calendar into chat as the bot's opening act. So the first run records
 * everything silently and posts nothing; from then on only genuinely new IDs are
 * candidates.
 */
export function selectNewEvents(
  feed: ScrapedDuckEvent[],
  postedIds: ReadonlySet<string>,
  now: number
): EventSelection {
  // Cold start: remember everything, say nothing.
  if (postedIds.size === 0) {
    return {
      toPost: [],
      toSeedOnly: feed.map((event) => event.eventID),
      seeding: true,
    };
  }

  const unseen = feed.filter((event) => !postedIds.has(event.eventID));

  const announceable = unseen
    .filter((event) => isAnnounceable(event, now))
    .sort((a, b) => (toInstant(a.start) ?? 0) - (toInstant(b.start) ?? 0));

  const toPost = announceable.slice(0, MAX_POSTS_PER_RUN);

  // Anything unseen we are NOT posting gets recorded so it doesn't get
  // re-considered on every future poll. The overflow beyond the per-run cap is
  // deliberately excluded — it should post on the next run, not be swallowed.
  const posting = new Set(toPost.map((event) => event.eventID));
  const overflow = new Set(announceable.slice(MAX_POSTS_PER_RUN).map((e) => e.eventID));
  const toSeedOnly = unseen
    .map((event) => event.eventID)
    .filter((id) => !posting.has(id) && !overflow.has(id));

  return { toPost, toSeedOnly, seeding: false };
}

/**
 * A stable fingerprint of the current raid line-up.
 *
 * raids.json has no ID field, so identity is (tier, name). Sorted before
 * joining so a reordering of the feed — which happens — doesn't read as a
 * rotation change. `canBeShiny` is included because a boss becoming shiny-
 * eligible is genuinely news worth reposting.
 */
export function raidLineupFingerprint(bosses: ScrapedDuckRaidBoss[]): string {
  return bosses
    .map((boss) => `${boss.tier}|${boss.name}|${boss.canBeShiny ? 's' : ''}`)
    .sort()
    .join('\n');
}

export interface RaidLineupDiff {
  changed: boolean;
  fingerprint: string;
  added: ScrapedDuckRaidBoss[];
  removed: string[];
}

/**
 * Compare the current line-up against the last one we posted.
 *
 * `previous` is null on the first ever run, which counts as "changed" — unlike
 * events there is no spam risk, since a rotation is a single message.
 */
export function diffRaidLineup(
  bosses: ScrapedDuckRaidBoss[],
  previousFingerprint: string | null
): RaidLineupDiff {
  const fingerprint = raidLineupFingerprint(bosses);

  if (previousFingerprint === null) {
    return { changed: true, fingerprint, added: bosses, removed: [] };
  }

  if (previousFingerprint === fingerprint) {
    return { changed: false, fingerprint, added: [], removed: [] };
  }

  const previousKeys = new Set(
    previousFingerprint.split('\n').map((line) => line.split('|').slice(0, 2).join('|'))
  );
  const currentKeys = new Set(bosses.map((boss) => `${boss.tier}|${boss.name}`));

  const added = bosses.filter((boss) => !previousKeys.has(`${boss.tier}|${boss.name}`));
  const removed = [...previousKeys].filter((key) => !currentKeys.has(key));

  return { changed: true, fingerprint, added, removed };
}
