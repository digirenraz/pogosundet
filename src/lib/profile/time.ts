// Pure time-formatting helpers for the player profile surface.
// No React, no Supabase — safe to unit-test in isolation.
// Follows the same pattern as src/lib/chat/time.ts.

/**
 * Returns a humanized Danish string for how long ago a player was last seen,
 * or null if lastSeenAt is null/undefined (i.e. no data yet).
 *
 * Buckets:
 *   < 2 min        → "Lige nu"
 *   < 1 hour       → "For {n} min. siden"
 *   1–2 hours      → "For en time siden"
 *   2–24 hours     → "For {n} timer siden"
 *   1–2 days       → "I går"
 *   2–7 days       → "For {n} dage siden"
 *   7–14 days      → "For en uge siden"
 *   14–30 days     → "For {n} uger siden"
 *   30–60 days     → "For en måned siden"
 *   > 60 days      → "For længe siden"
 */
export function lastSeenRelative(
  lastSeenAt: string | null | undefined,
  now: Date
): string | null {
  if (lastSeenAt == null) return null;

  const diffMs = now.getTime() - new Date(lastSeenAt).getTime();
  const diffMin = diffMs / 60_000;
  const diffHours = diffMs / 3_600_000;
  const diffDays = diffMs / 86_400_000;

  if (diffMin < 2) return 'Lige nu';
  if (diffMin < 60) return `For ${Math.floor(diffMin)} min. siden`;
  if (diffHours < 2) return 'For en time siden';
  if (diffHours < 24) return `For ${Math.floor(diffHours)} timer siden`;
  if (diffDays < 2) return 'I går';
  if (diffDays < 7) return `For ${Math.floor(diffDays)} dage siden`;
  if (diffDays < 14) return 'For en uge siden';
  if (diffDays < 30) return `For ${Math.floor(diffDays / 7)} uger siden`;
  if (diffDays < 60) return 'For en måned siden';
  return 'For længe siden';
}
