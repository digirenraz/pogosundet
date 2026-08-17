// One poll cycle: fetch both feeds, work out what changed, post the diffs.
//
// Kept out of the route handler so the route is just auth + JSON, and so this
// can be driven directly from a test or a script.
//
// Failure policy throughout: a failing feed, a failing post or a failing state
// write degrades this run, never the next one. Nothing here throws.

import { fetchEvents, fetchRaidBosses } from './feed';
import { selectNewEvents, diffRaidLineup } from './diff';
import { formatEventMessage, formatRaidRotationMessage } from './format';
import { getState, setState, getPostedEventIds, markEventsPosted } from './state';
import { postAsBot } from './post';
import { STATE_KEY_RAID_FINGERPRINT, STATE_KEY_RAIDS_ETAG } from './types';

/** The channel the bot posts to. */
const BOT_CHANNEL = 'events' as const;

export interface RunSummary {
  eventsPosted: number;
  rotationPosted: boolean;
  seeded: number;
  /** Non-fatal problems, for the cron log. */
  notes: string[];
}

export async function runFeedPoll(now: Date = new Date()): Promise<RunSummary> {
  const summary: RunSummary = {
    eventsPosted: 0,
    rotationPosted: false,
    seeded: 0,
    notes: [],
  };

  await Promise.all([
    pollEvents(now, summary).catch((err) => {
      console.error('[pogo-feed] events poll threw', err);
      summary.notes.push('events_threw');
    }),
    pollRaidRotation(summary).catch((err) => {
      console.error('[pogo-feed] raids poll threw', err);
      summary.notes.push('raids_threw');
    }),
  ]);

  return summary;
}

async function pollEvents(now: Date, summary: RunSummary): Promise<void> {
  // Deliberately NOT a conditional GET, unlike the raids poll.
  //
  // The 5-post-per-run cap means work can be left pending while the feed itself
  // is unchanged: 9 new events post 5 now and 4 next run. With If-None-Match we
  // would get a 304 on the next run and skip — stranding those 4 until the feed
  // content happened to change, which can be days. GitHub's ETag is a content
  // hash, so it stays stable exactly when we still have work to do.
  //
  // The cost of skipping the optimisation is ~44 KB every 20 minutes.
  const result = await fetchEvents();

  if (result.status === 'unchanged') {
    summary.notes.push('events_unchanged');
    return;
  }

  if (result.status === 'error') {
    summary.notes.push(`events_${result.reason}`);
    return;
  }

  const postedIds = await getPostedEventIds();
  const selection = selectNewEvents(result.data, postedIds, now.getTime());

  // Record the cold-start seed and the filtered-out events together — neither
  // gets posted, both should stop being re-evaluated every 20 minutes.
  const byId = new Map(result.data.map((event) => [event.eventID, event]));

  if (selection.toSeedOnly.length > 0) {
    const seedRows = selection.toSeedOnly
      .map((id) => byId.get(id))
      .filter((event): event is NonNullable<typeof event> => event !== undefined);
    await markEventsPosted(seedRows);
    summary.seeded = seedRows.length;
  }

  if (selection.seeding) {
    // First ever run: the ledger was empty and the feed holds the whole
    // LeekDuck calendar. Remember it, announce none of it.
    summary.notes.push('seeded_on_first_run');
  }

  for (const event of selection.toPost) {
    // Record before posting: a crash here loses an announcement rather than
    // repeating one on the next poll.
    const { error: markError } = await markEventsPosted([event]);
    if (markError) {
      summary.notes.push(`skip_${event.eventID}_unrecorded`);
      continue;
    }

    const { error } = await postAsBot(BOT_CHANNEL, formatEventMessage(event, now));
    if (error) {
      summary.notes.push(`post_failed_${event.eventID}`);
      continue;
    }

    summary.eventsPosted += 1;
  }
}

async function pollRaidRotation(summary: RunSummary): Promise<void> {
  const etag = await getState(STATE_KEY_RAIDS_ETAG);
  const result = await fetchRaidBosses(etag);

  if (result.status === 'unchanged') {
    summary.notes.push('raids_unchanged');
    return;
  }

  if (result.status === 'error') {
    summary.notes.push(`raids_${result.reason}`);
    return;
  }

  // An empty lineup means a bad scrape upstream, not "no raids today". Posting
  // it would wipe the fingerprint and produce a nonsense message.
  if (result.data.length === 0) {
    summary.notes.push('raids_empty');
    return;
  }

  const previous = await getState(STATE_KEY_RAID_FINGERPRINT);
  const diff = diffRaidLineup(result.data, previous);

  if (!diff.changed) {
    if (result.etag) await setState(STATE_KEY_RAIDS_ETAG, result.etag);
    return;
  }

  // Fingerprint first, for the same reason events are recorded first.
  await setState(STATE_KEY_RAID_FINGERPRINT, diff.fingerprint);

  const { error } = await postAsBot(BOT_CHANNEL, formatRaidRotationMessage(result.data));
  if (error) {
    summary.notes.push('rotation_post_failed');
  } else {
    summary.rotationPosted = true;
  }

  if (result.etag) await setState(STATE_KEY_RAIDS_ETAG, result.etag);
}
