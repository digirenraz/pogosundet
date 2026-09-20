// Recording that a question was asked (migration 027).
//
// Two purposes, and NEITHER of them needs the question text: counting rows is
// what the rate limiter does, and token counts are what spend monitoring needs.
// The question itself already exists as an ordinary channel_messages row that
// the member can see and that cascades away with their account. A second copy
// here would be personal data kept for no additional purpose — see the header of
// migration 027.
//
// Nor does it record WHICH channel the question was asked in. That column was
// written and never read — the rate limiter counts by user and time only — and a
// field nothing reads is personal data (where a member was active, and when)
// collected for no purpose. Removed on the same reasoning that deleted the
// always-null `accuracy_m` column during the live-location slice's /gdpr-check.
// The channel is still in the request log line and in Sentry context, which is
// where it was actually useful.
//
// Service-role only; bot_questions has RLS on with no policies.

import { createAdminClient } from '@/lib/supabase/admin';
import type { AnswerUsage } from './types';

interface LogQuestionInput {
  userId: string;
}

/**
 * Claim a rate-limit slot, BEFORE the model is called.
 *
 * The row is written up front rather than after the answer, and that ordering is
 * load-bearing. checkRateLimit counts rows in this table; the model call takes
 * seconds. If the row only appeared afterwards, every request that started
 * during that window would count the same pre-answer total and pass — so a
 * member could hold several questions in flight at once and sail past a limit
 * that only ever saw zero. Writing first makes the ledger a claim rather than a
 * receipt, the same reason claimEvent inserts before posting in
 * src/lib/pogo-feed/state.ts.
 *
 * Token counts are filled in afterwards by recordUsage(). A row that keeps its
 * null tokens is an attempt that failed — which still counts against the limit,
 * deliberately, so a failing model cannot become a way to ask unlimited
 * questions.
 *
 * Never throws. Returns the row id, or null if the claim could not be written —
 * callers treat null as "not rate limited, just unrecorded" and carry on, since
 * the answer matters more than the bookkeeping. A logging outage disabling the
 * rate limiter is acceptable because checkRateLimit fails closed, so the same
 * outage refuses new questions anyway.
 */
export async function claimQuestionSlot({
  userId,
}: LogQuestionInput): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('bot_questions')
    .insert({ user_id: userId })
    .select('id')
    .single();

  if (error) {
    console.error(`[pogo-qa] failed to claim a question slot: ${error.message}`);
    return null;
  }

  return (data?.id as string) ?? null;
}

/**
 * Fill in what the answer actually cost, once it is known.
 *
 * Separate from the claim so that spend reporting reflects real usage while the
 * rate limit is enforced up front. Never throws: the member already has their
 * answer, and losing a token count is not worth failing the request over.
 */
export async function recordUsage(
  id: string | null,
  usage: AnswerUsage
): Promise<void> {
  if (!id) return;

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('bot_questions')
    .update({
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      web_searches: usage.webSearches,
    })
    .eq('id', id);

  if (error) {
    console.error(`[pogo-qa] failed to record usage: ${error.message}`);
  }
}
