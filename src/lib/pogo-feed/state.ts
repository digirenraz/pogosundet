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

/** Every event ID the bot has already handled. */
export async function getPostedEventIds(): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('pogo_feed_posted_events').select('event_id');

  if (error || !data) {
    console.error(`[pogo-feed] failed to read posted events: ${error?.message ?? 'no data'}`);
    return new Set();
  }

  return new Set(data.map((row) => row.event_id as string));
}

/**
 * Record event IDs as handled.
 *
 * Called BEFORE the message is posted, so a crash between recording and posting
 * loses a message rather than repeating one — the safer failure direction for a
 * bot, and the same lesson as the non-idempotent createProfile retry bug.
 *
 * `ignoreDuplicates` makes a concurrent second run a no-op instead of a 23505.
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
