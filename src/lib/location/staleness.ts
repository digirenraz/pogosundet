// Pure staleness/formatting helpers for live location sharing.
// No React, no Supabase — safe to unit-test in isolation. Same shape as
// src/lib/profile/time.ts.
//
// WHY THIS FILE EXISTS AT ALL. A web app cannot read location in the
// background: navigator.geolocation is a window API, so no service worker,
// push handler or background sync can refresh a position while the app is
// closed — and iOS freezes a backgrounded PWA within seconds. Every position
// we show is therefore a snapshot from the last time that person had the app
// open, and could be minutes old.
//
// The whole feature rests on being honest about that. A pin must never be able
// to pass for live, so every surface renders an age alongside the position and
// visibly de-emphasises anything past STALE_AFTER_MINUTES.

import { REFRESH_THROTTLE_MS, STALE_AFTER_MINUTES } from './types';

/** Whole minutes since a position was captured. Never negative (clock skew). */
export function locationAgeMinutes(updatedAt: string, now: Date): number {
  const diffMs = now.getTime() - new Date(updatedAt).getTime();
  return Math.max(0, Math.floor(diffMs / 60_000));
}

/**
 * True once a position is old enough that it should be visibly de-emphasised
 * (greyed marker, reduced-opacity card).
 */
export function isStale(updatedAt: string, now: Date): boolean {
  return locationAgeMinutes(updatedAt, now) >= STALE_AFTER_MINUTES;
}

/**
 * Danish label for how old a position is. Always rendered next to the pin, so
 * nobody has to guess whether a position is current.
 *
 * Buckets:
 *   < 1 min    → "lige nu"
 *   1 min      → "set 1 min siden"
 *   < 60 min   → "set {n} min siden"
 *   >= 60 min  → "set for over en time siden"
 */
export function locationAgeLabel(updatedAt: string, now: Date): string {
  const minutes = locationAgeMinutes(updatedAt, now);
  if (minutes < 1) return 'lige nu';
  if (minutes === 1) return 'set 1 min siden';
  if (minutes < 60) return `set ${minutes} min siden`;
  return 'set for over en time siden';
}

/**
 * Clock time a share runs until, e.g. "til 14:30". Danish 24-hour format.
 * Returns null once the window has already closed.
 */
export function shareEndsLabel(expiresAt: string, now: Date): string | null {
  const end = new Date(expiresAt);
  if (end.getTime() <= now.getTime()) return null;
  const hh = String(end.getHours()).padStart(2, '0');
  const mm = String(end.getMinutes()).padStart(2, '0');
  return `til ${hh}:${mm}`;
}

/**
 * Has a share's window closed?
 *
 * Callers must filter on this rather than waiting for a Realtime DELETE:
 * Supabase filters postgres_changes DELETE events against the OLD row, and the
 * table's SELECT policy (expires_at > now()) is false by construction for a row
 * being purged for expiry — so the removal event may never reach other viewers.
 * Without this filter an expired pin would sit on screen indefinitely.
 */
export function isShareExpired(expiresAt: string, now: Date): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

/** Whole minutes left on a share, floored at 0. Drives the "47 min tilbage" banner. */
export function minutesRemaining(expiresAt: string, now: Date): number {
  const diffMs = new Date(expiresAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / 60_000));
}

/**
 * Should the refresh-on-focus path write a new position right now?
 *
 * Extracted as a pure predicate specifically so it can be unit-tested — it is
 * the one piece of the foreground-refresh machinery where a bug is invisible
 * (too eager just wastes writes; too lazy silently leaves everyone's pin stale).
 *
 * `lastWriteAt` is null when no position has been written yet this session, in
 * which case we always write.
 */
export function shouldRefreshPosition(
  lastWriteAt: number | null,
  now: number,
  throttleMs: number = REFRESH_THROTTLE_MS
): boolean {
  if (lastWriteAt == null) return true;
  return now - lastWriteAt >= throttleMs;
}
