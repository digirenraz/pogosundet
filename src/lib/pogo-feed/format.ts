// Danish message text for the event bot. Pure — no Supabase, no I/O — so the
// wording and the date handling are directly unit-testable.
//
// Register follows src/lib/changelog/entries.ts: informal, game terms left in
// English (raid, boss, shiny), emoji fine, no jargon.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE TIMEZONE TRAP — read before touching anything date-related.
//
// ScrapedDuck encodes two different meanings in the same `start`/`end` fields:
//
//   "2026-08-19T18:00:00.000"   no suffix → LOCAL WALL-CLOCK. Raid Hour is 18:00
//                               for everyone on earth. The digits ARE the answer;
//                               there is no instant to convert.
//
//   "2026-08-28T16:00:00.000Z"  Z suffix  → ONE GLOBAL INSTANT (GBL seasons,
//                               some research). Must be converted to
//                               Europe/Copenhagen before display.
//
// The trap: `new Date("2026-08-19T18:00:00.000")` parses as *server-local*,
// which on Vercel is UTC — so a naive parse renders Danish summer events two
// hours early. Never hand a naive feed string to `new Date()`.
// ─────────────────────────────────────────────────────────────────────────────

import { CHAT_MESSAGE_MAX_LENGTH } from '@/lib/chat/types';
import type { ScrapedDuckEvent, ScrapedDuckRaidBoss } from './types';

const COPENHAGEN = 'Europe/Copenhagen';

const MONTHS_DA = [
  'jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.',
  'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.',
];

const WEEKDAYS_DA = [
  'søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag',
];

/** A calendar date + time of day, with no timezone attached. */
interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

const NAIVE_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/** Does this timestamp name a real instant (Z or an explicit offset)? */
function hasTimezone(value: string): boolean {
  return /[Zz]$|[+-]\d{2}:\d{2}$/.test(value);
}

/** Read the Copenhagen wall-clock reading of an absolute instant. */
function wallClockInCopenhagen(date: Date): WallClock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: COPENHAGEN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const read = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  };
}

/**
 * Turn a feed timestamp into the wall-clock time a Danish player should read.
 *
 * Naive strings are returned digit-for-digit; Z/offset strings are converted.
 */
export function parseFeedTimestamp(value: string | null): WallClock | null {
  if (!value) return null;

  if (hasTimezone(value)) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : wallClockInCopenhagen(new Date(ms));
  }

  const match = NAIVE_TIMESTAMP.exec(value);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

/** Days since epoch for a wall-clock date, for cheap "is this today?" maths. */
function dayNumber(wc: WallClock): number {
  return Date.UTC(wc.year, wc.month - 1, wc.day) / 86_400_000;
}

function formatTime(wc: WallClock): string {
  return `${String(wc.hour).padStart(2, '0')}:${String(wc.minute).padStart(2, '0')}`;
}

/** Wall-clock minutes since epoch — lets us compare two WallClocks directly. */
function minutesSinceEpoch(wc: WallClock): number {
  return dayNumber(wc) * 1440 + wc.hour * 60 + wc.minute;
}

/** Can this date be written relatively ("i dag", "tirsdag") rather than as a date? */
function isRelativeDay(wc: WallClock, today: WallClock): boolean {
  const diff = dayNumber(wc) - dayNumber(today);
  return diff >= 0 && diff < 7;
}

/**
 * "i dag" / "i morgen" / "tirsdag" within the coming week / "19. aug." beyond.
 *
 * `absolute` forces the date form. Used to keep both ends of a range in the same
 * register — "12. aug. 06:00 – tirsdag 22:00" reads badly.
 */
function formatDay(wc: WallClock, today: WallClock, absolute = false): string {
  if (!absolute && isRelativeDay(wc, today)) {
    const diff = dayNumber(wc) - dayNumber(today);
    if (diff === 0) return 'i dag';
    if (diff === 1) return 'i morgen';
    const weekday = new Date(Date.UTC(wc.year, wc.month - 1, wc.day)).getUTCDay();
    return WEEKDAYS_DA[weekday];
  }

  return `${wc.day}. ${MONTHS_DA[wc.month - 1]}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The human-readable time window for an event.
 *
 * Returns '' when the feed gives us nothing usable — the caller drops the line
 * rather than printing an empty date.
 */
export function formatEventWindow(
  start: string | null,
  end: string | null,
  now: Date
): string {
  const today = wallClockInCopenhagen(now);
  const from = parseFeedTimestamp(start);
  const to = parseFeedTimestamp(end);

  if (!from && !to) return '';

  if (!from && to) {
    return capitalise(`slutter ${formatDay(to, today)} ${formatTime(to)}`);
  }

  if (from && !to) {
    return capitalise(`${formatDay(from, today)} ${formatTime(from)}`);
  }

  if (!from || !to) return '';

  // Same calendar day: one date, a time range.
  if (dayNumber(from) === dayNumber(to)) {
    return capitalise(`${formatDay(from, today)} ${formatTime(from)}–${formatTime(to)}`);
  }

  // Already running. The start date is history — when it ends is the useful
  // part, and leading with a date from last week reads like stale news.
  const nowMinutes = minutesSinceEpoch(today);
  if (minutesSinceEpoch(from) <= nowMinutes && minutesSinceEpoch(to) > nowMinutes) {
    return capitalise(`slutter ${formatDay(to, today)} ${formatTime(to)}`);
  }

  // Multi-day range: keep both ends in the same register. If either endpoint is
  // too far out for a relative label, write both as dates.
  const absolute = !isRelativeDay(from, today) || !isRelativeDay(to, today);

  return capitalise(
    `${formatDay(from, today, absolute)} ${formatTime(from)} – ` +
      `${formatDay(to, today, absolute)} ${formatTime(to)}`
  );
}

/** A little visual marker per event type. */
const EVENT_EMOJI: Record<string, string> = {
  'raid-hour': '⏰',
  'raid-day': '🎉',
  'raid-battles': '⚔️',
  'elite-raids': '🌟',
};

/**
 * A single event announcement.
 *
 * Three lines: what, when, where to read more. The link is on its own line so
 * the linkifier in the chat renderer turns it into a clean tappable target.
 */
export function formatEventMessage(event: ScrapedDuckEvent, now: Date): string {
  const emoji = EVENT_EMOJI[event.eventType] ?? '📅';
  const lines = [`${emoji} ${event.name}`];

  const window = formatEventWindow(event.start, event.end, now);
  if (window) lines.push(window);

  if (event.link) lines.push(event.link);

  return truncate(lines.join('\n'));
}

/**
 * Known tier ordering, strongest last.
 *
 * Matched by exact string, with unknown tiers sorted to the end alphabetically.
 * These labels have drifted before — the wiki still documents "Tier 3" while the
 * live feed returns "3-Star Raids" — so an unrecognised tier must degrade to
 * "show it at the bottom", never to a crash or a dropped boss.
 */
const TIER_ORDER = [
  '1-Star Raids',
  '3-Star Raids',
  '5-Star Raids',
  'Mega Raids',
  'Shadow Raids',
  'Elite Raids',
];

function tierRank(tier: string): number {
  const index = TIER_ORDER.indexOf(tier);
  return index === -1 ? TIER_ORDER.length : index;
}

/**
 * The raid rotation post.
 *
 * Grouped by tier, shiny-eligible bosses marked with ✨. Carries the LeekDuck /
 * ScrapedDuck attribution required by ScrapedDuck's terms of use.
 */
export function formatRaidRotationMessage(bosses: ScrapedDuckRaidBoss[]): string {
  const byTier = new Map<string, ScrapedDuckRaidBoss[]>();
  for (const boss of bosses) {
    const group = byTier.get(boss.tier);
    if (group) group.push(boss);
    else byTier.set(boss.tier, [boss]);
  }

  const tiers = [...byTier.keys()].sort((a, b) => {
    const rank = tierRank(a) - tierRank(b);
    return rank !== 0 ? rank : a.localeCompare(b, 'da');
  });

  const lines = ['🔄 Raid-bosserne er skiftet'];

  for (const tier of tiers) {
    lines.push('', tier);
    for (const boss of byTier.get(tier) ?? []) {
      lines.push(`• ${boss.name}${boss.canBeShiny ? ' ✨' : ''}`);
    }
  }

  lines.push('', 'Data: LeekDuck.com via ScrapedDuck');

  return truncate(lines.join('\n'));
}

/**
 * Keep a message inside the DB CHECK on channel_messages.body (migration 019,
 * mirrored by CHAT_MESSAGE_MAX_LENGTH). Cuts on a line boundary so a truncated
 * rotation post doesn't end mid-boss.
 */
export function truncate(text: string, max = CHAT_MESSAGE_MAX_LENGTH): string {
  if (text.length <= max) return text;

  const ellipsis = '\n…';
  const budget = max - ellipsis.length;
  const cut = text.slice(0, budget);
  const lastBreak = cut.lastIndexOf('\n');

  return (lastBreak > 0 ? cut.slice(0, lastBreak) : cut) + ellipsis;
}
