// POST /api/bot/ask
// Answers a "!pogo <spørgsmål>" chat message. The client posts the message to
// channel_messages as normal, then calls this with the new message's id; the
// bot's answer lands as a threaded reply in the same channel.
//
// Body: { messageId: string }
//
// Responses:
//   200 { ok: true }                              — answered, or already had been
//   400 { error: 'bad_request' }                  — missing/malformed messageId
//   401 { error: 'unauthorized' }                 — no session
//   403 { error: 'banned' }
//   404 { error: 'message_not_found' }            — see the note below
//   429 { error: 'rate_limited', scope }          — 'user' | 'global'
//   503 { error: 'not_configured' }               — no API key or no bot user
//   500 { error: 'answer_failed' }                — model call failed
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS IS NOT AN OPEN LLM PROXY
//
// The obvious risk of a client-triggered endpoint is somebody skipping the chat
// UI and POSTing arbitrary prompts straight here, on our API key. What prevents
// that is that this route does not accept a question at all — it accepts an id,
// and then reads the question out of the database itself. To get an answer you
// must first have inserted a real channel_messages row, which RLS only lets you
// do as yourself, unbanned, in a real channel. Every property of the question is
// therefore established by the database, not asserted by the caller.
//
// All five verification failures collapse into one 404 on purpose. Telling a
// prober which check they failed maps out the rules for them.
// ─────────────────────────────────────────────────────────────────────────────
//
// AUTH POSTURE — fail-closed, like /api/cron/pogo-feed and unlike the fail-open
// isAuthorizedCaller() in the notify-* Edge Functions. Those must never let a
// missing secret silence live push. This one spends money and writes into chat,
// so an unset key means "off", not "open".
//
// Note src/proxy.ts excludes /api from the middleware matcher, so this route
// gets no centralised session refresh and no ban guard. It gates itself.

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { postAsBot, isBotConfigured, botUserId } from '@/lib/pogo-feed/post';
import type { ChannelId } from '@/lib/chat/channels';
import { isQaChannel } from '@/lib/pogo-qa/types';
import { parseQuestion } from '@/lib/pogo-qa/trigger';
import { isUserBanned, checkRateLimit } from '@/lib/pogo-qa/limits';
import { answerQuestion } from '@/lib/pogo-qa/answer';
import { claimQuestionSlot, recordUsage } from '@/lib/pogo-qa/log';

export const preferredRegion = 'dub1';

/**
 * How stale a question may be before we refuse to answer it.
 *
 * The client calls this immediately after sending. A wide window would let
 * someone replay old message ids to re-run answers; a narrow one costs nothing,
 * because the legitimate caller is milliseconds behind its own insert.
 */
const MAX_MESSAGE_AGE_MS = 60_000;

/** The Danish apology posted when the model could not produce an answer. */
const FALLBACK_MESSAGE = 'Beklager, jeg kunne ikke svare lige nu. Prøv igen om lidt.';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  // Fail closed before anything else: no key or no bot account means the feature
  // is simply not deployed here.
  if (!process.env.ANTHROPIC_API_KEY || !isBotConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let messageId: unknown;
  try {
    ({ messageId } = await request.json());
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  if (typeof messageId !== 'string' || !UUID_RE.test(messageId)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  try {
    // Admin client from here: bot_questions and the bot's own INSERT are all
    // service-role-only, and reading the question back must not depend on the
    // caller's RLS view of it.
    const admin = createAdminClient();

    const { data: message, error: messageError } = await admin
      .from('channel_messages')
      .select('id, channel, user_id, body, created_at')
      .eq('id', messageId)
      .maybeSingle();

    if (messageError) {
      Sentry.captureException(messageError, { extra: { messageId } });
      return NextResponse.json({ error: 'answer_failed' }, { status: 500 });
    }

    // The five checks that make this endpoint safe. One shared 404.
    const question = message ? parseQuestion(message.body as string) : null;
    const ageMs = message
      ? Date.now() - new Date(message.created_at as string).getTime()
      : Infinity;

    if (
      !message ||
      message.user_id !== user.id ||
      !isQaChannel(message.channel as string) ||
      question === null ||
      ageMs > MAX_MESSAGE_AGE_MS
    ) {
      return NextResponse.json({ error: 'message_not_found' }, { status: 404 });
    }

    const channel = message.channel as ChannelId;

    // Idempotent: a retry (or a double-tap, or a client that resent on a flaky
    // connection) must not produce a second answer or a second charge.
    const { count: existingAnswers } = await admin
      .from('channel_messages')
      .select('*', { count: 'exact', head: true })
      .eq('reply_to_id', messageId)
      .eq('user_id', botUserId() as string);

    if ((existingAnswers ?? 0) > 0) {
      return NextResponse.json({ ok: true });
    }

    // RLS already stopped a banned member from posting the question at all; this
    // catches somebody banned in the seconds since. See the comment in limits.ts
    // for why is_banned() cannot be used here.
    if (await isUserBanned(user.id)) {
      return NextResponse.json({ error: 'banned' }, { status: 403 });
    }

    const limit = await checkRateLimit(user.id);
    if (!limit.allowed) {
      // Deliberately no chat message. Announcing every refusal in the channel
      // would turn one member hitting a limit into noise for everybody; the
      // client shows this inline to the person who asked.
      return NextResponse.json(
        { error: 'rate_limited', scope: limit.scope },
        { status: 429 }
      );
    }

    // Claim the rate-limit slot BEFORE spending anything. The model call takes
    // seconds, and a slot recorded only afterwards would let every request that
    // started in that window count the same pre-answer total and pass — see the
    // header of log.ts. A failed answer keeps its claim on purpose, so a failing
    // model cannot become a way to ask unlimited questions.
    const slotId = await claimQuestionSlot({ userId: user.id });

    const result = await answerQuestion(question);

    if (!result.ok) {
      console.error(`[pogo-qa] answer failed: ${result.reason}`);

      // Say something rather than leaving the member watching a typing
      // indicator that never resolves.
      await postAsBot(channel, FALLBACK_MESSAGE, messageId);
      return NextResponse.json({ error: 'answer_failed' }, { status: 500 });
    }

    await recordUsage(slotId, result.usage);

    const { error: postError } = await postAsBot(channel, result.text, messageId);
    if (postError) {
      Sentry.captureException(postError, { extra: { messageId, channel } });
      return NextResponse.json({ error: 'answer_failed' }, { status: 500 });
    }

    console.log(
      `[pogo-qa] answered in #${channel} ` +
        `in=${result.usage.inputTokens} out=${result.usage.outputTokens} ` +
        `searches=${result.usage.webSearches}`
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    // A bare console.error never reaches Sentry here — no captureConsoleIntegration
    // is registered — and this is the only signal we would get for a bug in a
    // route that spends money.
    Sentry.captureException(err, { extra: { messageId, userId: user.id } });
    return NextResponse.json({ error: 'answer_failed' }, { status: 500 });
  }
}

// A stray GET should not look like a broken endpoint, and must not spend money.
export function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
