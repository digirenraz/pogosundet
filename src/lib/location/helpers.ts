import { createClient } from '@/lib/supabase/client';
import type { LiveLocation } from './types';

// Data-layer helpers for live location sharing (migration 026).
//
// Every write goes through an RPC rather than a table insert. live_locations
// has no INSERT or UPDATE policy at all, so the SECURITY DEFINER functions are
// the only write path — that is what makes the 2-hour cap and the coordinate
// rounding real guarantees instead of client-side conventions. Stopping a share
// is a plain DELETE (covered by its own RLS policy) so that it keeps working
// even if the RPCs are broken; being unable to stop sharing is the one failure
// mode this feature must not have.

export interface StartShareInput {
  lat: number;
  lng: number;
  minutes: number;
  note?: string | null;
}

/**
 * Start (or replace) the current user's share. Returns the expiry the server
 * decided on — which may be sooner than asked for, since the RPC clamps the
 * duration. Always trust this value over the requested one.
 */
export async function startShare(input: StartShareInput): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('start_location_share', {
    p_lat: input.lat,
    p_lng: input.lng,
    p_minutes: input.minutes,
    p_note: input.note ?? null,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Move the current user's pin without touching their expiry. Bringing the app
 * to the foreground should update where you are, never quietly extend how long
 * you are sharing for — so this is deliberately a separate RPC from
 * startShare().
 *
 * Resolves to null when there was no active share to refresh (it expired
 * between the client deciding to refresh and the write landing); the caller
 * treats that as "sharing has ended", not as an error.
 */
export async function refreshShare(lat: number, lng: number): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('refresh_location_share', {
    p_lat: lat,
    p_lng: lng,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/**
 * Stop sharing. Hard delete — there is no soft-delete column and no history
 * table, so this removes the position outright.
 */
export async function stopShare(userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('live_locations').delete().eq('user_id', userId);
  if (error) throw error;
}

/**
 * Read every active share. The RPC purges expired rows before selecting, so a
 * position can never outlive the moment someone looks at the screen even if
 * the pg_cron job is disabled.
 *
 * Returns [] on error so the map screen degrades to an empty state rather than
 * blowing up — same philosophy as fetchGyms().
 */
export async function fetchLiveLocations(): Promise<LiveLocation[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_live_locations');
  if (error || !data) return [];
  return data as LiveLocation[];
}

/** The current user's own active share, or null. Used to restore banner state on load. */
export function findOwnShare(
  locations: LiveLocation[],
  userId: string | null
): LiveLocation | null {
  if (!userId) return null;
  return locations.find(l => l.user_id === userId) ?? null;
}
