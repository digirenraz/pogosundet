// Shared types and constants for live location sharing ("Hvem spiller nu").
// See supabase/migrations/026_live_locations.sql for the storage contract.

import type { GymLocation } from '@/lib/gyms/maps';

/** One active share, as returned by the get_live_locations() RPC. */
export interface LiveLocation {
  user_id: string;
  lat: number;
  lng: number;
  /** Optional free-text hint the sharer typed ("ved havnen"). */
  note: string | null;
  /** When the position was last captured — what the "set for X min siden" label reads. */
  updated_at: string;
  expires_at: string;
  trainer_name: string;
  avatar_url: string | null;
  team: string | null;
  level: number | null;
}

/** Durations offered in the share sheet, in minutes. */
export const SHARE_DURATIONS = [15, 30, 60, 120] as const;

/**
 * Hard ceiling on a share window. Mirrored in start_location_share() — the
 * database is the real enforcement point; this constant only keeps the UI
 * from offering something the RPC would clamp anyway.
 */
export const MAX_SHARE_MINUTES = 120;

/** Longest a note may be (matches the CHECK constraint on live_locations.note). */
export const MAX_NOTE_LENGTH = 80;

/**
 * A position is "stale" once it is older than this. Stale pins are greyed and
 * de-emphasised — see staleness.ts for why that matters.
 */
export const STALE_AFTER_MINUTES = 10;

/**
 * Minimum gap between two position writes. The refresh-on-focus path fires on
 * every foreground, which on a phone can be many times a minute; this keeps us
 * from hammering the database for movement nobody can see.
 */
export const REFRESH_THROTTLE_MS = 60_000;

/** Geolocation options for sharing — unlike gym sorting, this wants real precision. */
export const SHARE_GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15_000,
};

/** Narrow a LiveLocation to the {lat, lng} shape the distance helpers take. */
export function toGymLocation(location: LiveLocation): GymLocation {
  return { lat: location.lat, lng: location.lng };
}
