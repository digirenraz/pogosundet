// The bot's live-data tools.
//
// Without these the model answers raid questions from training knowledge, which
// for a rotation that changes roughly daily means confidently wrong. These hand
// it the same ScrapedDuck feed the #events poller uses, so "hvad er raid-bossen
// nu" is answered from the same source that posted the rotation — no second
// cache, no second cadence, no chance of the two disagreeing.
//
// NEITHER HANDLER THROWS. A feed outage returns a sentence saying the data is
// unavailable, so the model can say "det kan jeg ikke se lige nu" instead of
// inventing a boss. Same principle as FeedResult in src/lib/pogo-feed/feed.ts:
// a third-party blip degrades the answer, it does not break the request.

import type Anthropic from '@anthropic-ai/sdk';
import { fetchEvents, fetchRaidBosses } from '@/lib/pogo-feed/feed';
import { formatEventWindow } from '@/lib/pogo-feed/format';
import { hasEnded } from '@/lib/pogo-feed/diff';

/** Cap the event list so one tool result can't dominate the input budget. */
const MAX_EVENTS_RETURNED = 15;

export const GET_CURRENT_RAID_BOSSES: Anthropic.Beta.BetaTool = {
  name: 'get_current_raid_bosses',
  description:
    'Get the raid bosses currently active in Pokémon GO, grouped by tier, with ' +
    'shiny availability. Use this for any question about what is in raids right ' +
    'now, which boss to fight, or what is worth raiding. Returns live data.',
  input_schema: { type: 'object', properties: {}, additionalProperties: false },
};

export const GET_UPCOMING_EVENTS: Anthropic.Beta.BetaTool = {
  name: 'get_upcoming_events',
  description:
    'Get upcoming and currently-running Pokémon GO events (raid hours, raid days, ' +
    'elite raids and similar), with their times in Danish local time. Use this for ' +
    'any question about when something is happening. Returns live data.',
  input_schema: { type: 'object', properties: {}, additionalProperties: false },
};

export const QA_TOOLS = [GET_CURRENT_RAID_BOSSES, GET_UPCOMING_EVENTS];

/**
 * Current raid bosses, as plain text for the model.
 *
 * Returns EVERY tier, unlike the rotation post. POSTABLE_RAID_TIERS governs what
 * the poller *announces* (5-star and mega — the ones worth travelling for);
 * it has nothing to say about what a member is allowed to ask about. Somebody
 * asking "er der noget godt i 3-star lige nu?" deserves an answer.
 */
async function handleGetCurrentRaidBosses(): Promise<string> {
  const result = await fetchRaidBosses();

  if (result.status !== 'ok') {
    return 'Raid boss data is unavailable right now. Tell the user you cannot see the current raid bosses at the moment.';
  }

  if (result.data.length === 0) {
    return 'The raid boss feed returned no bosses. Tell the user you cannot see the current raid bosses at the moment.';
  }

  const byTier = new Map<string, string[]>();
  for (const boss of result.data) {
    const label = boss.canBeShiny ? `${boss.name} (can be shiny)` : boss.name;
    const group = byTier.get(boss.tier);
    if (group) group.push(label);
    else byTier.set(boss.tier, [label]);
  }

  const lines: string[] = ['Current raid bosses:'];
  for (const [tier, names] of byTier) {
    lines.push(`${tier}: ${names.join(', ')}`);
  }
  lines.push('Source: LeekDuck.com via ScrapedDuck.');

  return lines.join('\n');
}

/**
 * Upcoming and running events, as plain text for the model.
 *
 * Windows are rendered with formatEventWindow, which is the ONLY correct way to
 * read these timestamps — the feed mixes naive wall-clock strings with real
 * instants, and handing either straight to `new Date()` renders Danish summer
 * events two hours early. See the timezone-trap comment in
 * src/lib/pogo-feed/format.ts.
 */
async function handleGetUpcomingEvents(): Promise<string> {
  const result = await fetchEvents();

  if (result.status !== 'ok') {
    return 'Event data is unavailable right now. Tell the user you cannot see the event schedule at the moment.';
  }

  const now = new Date();
  const live = result.data
    .filter((event) => !hasEnded(event, now.getTime()))
    .slice(0, MAX_EVENTS_RETURNED);

  if (live.length === 0) {
    return 'No upcoming events in the feed right now.';
  }

  const lines: string[] = [
    'Upcoming and running events. Times are already in Danish local time — repeat them as written, do not convert:',
  ];

  for (const event of live) {
    const window = formatEventWindow(event.start, event.end, now);
    lines.push(`- ${event.name} (${event.eventType})${window ? ` — ${window}` : ''}`);
  }

  lines.push('Source: LeekDuck.com via ScrapedDuck.');

  return lines.join('\n');
}

/**
 * Run one tool call by name.
 *
 * An unknown name is a model mistake, not a crash: return a string saying so and
 * let it recover on the next turn.
 */
export async function runTool(name: string): Promise<string> {
  try {
    if (name === GET_CURRENT_RAID_BOSSES.name) return await handleGetCurrentRaidBosses();
    if (name === GET_UPCOMING_EVENTS.name) return await handleGetUpcomingEvents();
    return `Unknown tool: ${name}`;
  } catch (err) {
    // fetchEvents/fetchRaidBosses already swallow network errors, so reaching
    // here means something unexpected. Still must not unwind the request.
    console.error(`[pogo-qa] tool ${name} failed`, err);
    return 'That data is unavailable right now. Tell the user you cannot look it up at the moment.';
  }
}
