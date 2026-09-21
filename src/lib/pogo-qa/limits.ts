// The two gates that stand between a !pogo message and a metered API call:
// "is this member allowed to use the app at all?" and "have they asked too
// much?".
//
// Service-role only (bot_questions has RLS on with no policies, migration 027).
// Never import this from a client component.
//
// BOTH GATES FAIL CLOSED. That is the opposite of how src/lib/pogo-feed/ treats
// a read failure — there, a broken query means "skip this run" and nothing is
// lost but a poll. Here a broken query means we cannot prove the caller is
// allowed, and the thing on the other side costs money and posts under the
// bot's name in a public channel. Refusing a legitimate question during a
// database blip is a much smaller harm than answering an unlimited number of
// them.

import { createAdminClient } from '@/lib/supabase/admin';
import {
  USER_LIMIT_PER_HOUR,
  USER_LIMIT_PER_DAY,
  GLOBAL_LIMIT_PER_DAY,
  type RateLimitResult,
} from './types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Is this member banned?
 *
 * WHY NOT the is_banned() RPC (migration 024): that function takes no argument
 * and resolves auth.uid() internally, so it only ever answers for the *calling*
 * session. Under the service-role client there is no auth.uid() at all, which
 * makes it silently meaningless here rather than wrong-but-obvious. Every
 * existing call site in the app is self-referential for that reason; this is the
 * first place that needs "is user X banned?" and it has to read the column.
 *
 * That read works despite 024's column-level GRANT lockdown on banned_at,
 * because the service role bypasses column privileges along with RLS.
 *
 * Note RLS already blocks a banned member's INSERT into channel_messages, so
 * their !pogo message never exists in the first place. This check catches the
 * gap that leaves: somebody banned in the seconds between posting the question
 * and this route running.
 */
export async function isUserBanned(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('banned_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error(`[pogo-qa] failed to read ban status: ${error.message}`);
    // Fail closed: an unverifiable member does not get an answer.
    return true;
  }

  // No profile row is not a normal state for someone who just posted a message
  // (channel_messages carries an FK to profiles), so treat it the same way.
  if (!data) return true;

  return data.banned_at !== null;
}

/**
 * The cutoff instants the rate-limit queries count from.
 *
 * Split out as a pure function so the window maths is testable against a fixed
 * clock without standing up a database. Rolling windows, not calendar buckets:
 * a midnight reset would let someone spend the whole daily allowance at 23:59
 * and the whole next one at 00:01.
 */
export function rateLimitWindows(now: Date): { hourAgo: string; dayAgo: string } {
  const ms = now.getTime();
  return {
    hourAgo: new Date(ms - HOUR_MS).toISOString(),
    dayAgo: new Date(ms - DAY_MS).toISOString(),
  };
}

/**
 * Has this member (or the community) asked too much?
 *
 * Three ceilings. All three queries are fired concurrently and all three always
 * run — the `if` ordering below decides only which `scope` gets reported, not
 * which queries execute. One round-trip beats three sequential ones, and all
 * three are `head: true` counts that read no rows, so they stay cheap as the
 * table grows.
 *
 * Note the remaining TOCTOU window: this runs as its own round-trip before
 * claimQuestionSlot writes, so two requests arriving within a few milliseconds
 * of each other can both read the same count and both pass. Left as-is
 * deliberately. Closing it properly needs an insert-if-under-limit RPC so the
 * check and the claim are one atomic statement, which is real machinery for a
 * window a person cannot hit by hand — it takes two chat messages posted within
 * about 50ms. The bigger race, between claiming and the multi-second model call,
 * IS closed (see log.ts), and the Anthropic Console spend limit is the actual
 * backstop against a scripted abuser. Revisit if the bill ever shows it.
 */
export async function checkRateLimit(
  userId: string,
  now: Date = new Date()
): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  const { hourAgo, dayAgo } = rateLimitWindows(now);

  const [userHour, userDay, globalDay] = await Promise.all([
    supabase
      .from('bot_questions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('asked_at', hourAgo),
    supabase
      .from('bot_questions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('asked_at', dayAgo),
    supabase
      .from('bot_questions')
      .select('*', { count: 'exact', head: true })
      .gte('asked_at', dayAgo),
  ]);

  if (userHour.error || userDay.error || globalDay.error) {
    const message =
      userHour.error?.message ?? userDay.error?.message ?? globalDay.error?.message;
    console.error(`[pogo-qa] rate-limit read failed: ${message}`);
    // Fail closed. A counter that cannot be read must not become an open tap —
    // the failure mode of guessing "allowed" here is an unbounded API bill.
    return { allowed: false, scope: 'global' };
  }

  if ((userHour.count ?? 0) >= USER_LIMIT_PER_HOUR) return { allowed: false, scope: 'user' };
  if ((userDay.count ?? 0) >= USER_LIMIT_PER_DAY) return { allowed: false, scope: 'user' };
  if ((globalDay.count ?? 0) >= GLOBAL_LIMIT_PER_DAY) {
    return { allowed: false, scope: 'global' };
  }

  return { allowed: true };
}
