// Persistence for the event bot: the key/value state blob and the ledger of
// event IDs already announced (migration 023).
//
// Service-role only. These tables have RLS enabled with no policies, so the
// admin client is the only thing that can read or write them — see
// src/lib/supabase/admin.ts and the "three clients, never mix" rule in
// CLAUDE.md. Never import this from a client component.

import { createAdminClient } from '@/lib/supabase/admin';

/** Read a single state value. Returns null when unset or unreadable. */
export async function getState(key: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('pogo_feed_state')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error || !data) return null;

  // Stored as jsonb; we only ever put strings in it.
  return typeof data.value === 'string' ? data.value : null;
}

/** Write a state value, replacing any existing one. */
export async function setState(key: string, value: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('pogo_feed_state')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  if (error) {
    console.error(`[pogo-feed] failed to write state ${key}: ${error.message}`);
  }
}

/**
 * How many events the ledger holds. Used only to detect a cold start.
 *
 * A `head: true` count reads no rows, so it stays cheap as the table grows and
 * is unaffected by PostgREST's max-rows cap.
 */
export async function countPostedEvents(): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from('pogo_feed_posted_events')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error(`[pogo-feed] failed to count posted events: ${error.message}`);
    // Report non-zero: a failed count must not be mistaken for a cold start,
    // which would re-seed the ledger and suppress real announcements.
    return -1;
  }

  return count ?? 0;
}

/**
 * Which of `candidateIds` have already been announced.
 *
 * Scoped to the current feed rather than fetching the whole table. The ledger
 * only ever grows — nothing prunes it — so an unbounded select would eventually
 * cross PostgREST's default 1000-row cap and start silently dropping rows,
 * making previously-announced events look new and re-posting them. That is the
 * exact spam this table exists to prevent, and it would appear years after the
 * code was written.
 *
 * The feed carries ~40 events, so this query is bounded by feed size, not by
 * history, and the cap can never be reached.
 */
export async function getPostedEventIds(candidateIds: string[]): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('pogo_feed_posted_events')
    .select('event_id')
    .in('event_id', candidateIds);

  if (error || !data) {
    console.error(`[pogo-feed] failed to read posted events: ${error?.message ?? 'no data'}`);
    // An empty set here would make every event look new. Callers must treat a
    // read failure as "skip this run" rather than "post everything".
    throw new Error('failed to read posted events');
  }

  return new Set(data.map((row) => row.event_id as string));
}

/**
 * Record event IDs as handled, without claiming them.
 *
 * For the cold-start seed and for permanently-uninteresting events — cases
 * where nothing is posted, so a duplicate is harmless.
 */
export async function markEventsPosted(
  events: { eventID: string; eventType: string }[]
): Promise<{ error: unknown }> {
  if (events.length === 0) return { error: null };

  const supabase = createAdminClient();
  const { error } = await supabase.from('pogo_feed_posted_events').upsert(
    events.map((event) => ({ event_id: event.eventID, event_type: event.eventType })),
    { onConflict: 'event_id', ignoreDuplicates: true }
  );

  if (error) {
    console.error(`[pogo-feed] failed to record posted events: ${error.message}`);
  }

  return { error };
}

/**
 * Claim an event for posting. Returns whether THIS caller won the claim.
 *
 * A plain INSERT, not an upsert: the primary-key violation is the point. It
 * makes the ledger row a lock, so if two runs overlap — a manual curl racing
 * the scheduled workflow, say — exactly one gets `claimed: true` and only that
 * one posts. An upsert with `ignoreDuplicates` would let both believe they had
 * recorded the event and both post it.
 *
 * Claiming happens BEFORE posting, so a crash in between loses an announcement
 * rather than repeating one.
 */
export async function claimEvent(event: {
  eventID: string;
  eventType: string;
}): Promise<{ claimed: boolean }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('pogo_feed_posted_events')
    .insert({ event_id: event.eventID, event_type: event.eventType });

  if (!error) return { claimed: true };

  // 23505 = unique_violation. Someone else already claimed it; not an error.
  if ((error as { code?: string }).code === '23505') {
    return { claimed: false };
  }

  console.error(`[pogo-feed] failed to claim ${event.eventID}: ${error.message}`);
  return { claimed: false };
}
