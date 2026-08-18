// POST /api/cron/pogo-feed
// Polls the ScrapedDuck feed and posts new raid events + raid-boss rotation
// changes to #events as the bot. Triggered every 20 minutes by
// .github/workflows/pogo-feed.yml, and runnable by hand via workflow_dispatch.
//
// Responses:
//   200 { ok: true, ... }            — ran; the body says what it did
//   401 { error: 'unauthorized' }    — missing or wrong x-cron-secret
//   405 { error: 'method_not_allowed' }
//   503 { error: 'not_configured' }  — POGO_CRON_SECRET or POGO_BOT_USER_ID unset
//   500 { error: 'run_failed' }      — unexpected throw (the run itself is
//                                      internally fault-tolerant, so this is rare)
//
// AUTH NOTE — this gate is deliberately FAIL-CLOSED, unlike the fail-open
// isAuthorizedCaller() in the notify-* Edge Functions. Those are fail-open
// because they were retrofitted onto live push delivery, where an unset secret
// must never silence notifications. This endpoint *writes messages into chat*,
// so an unset secret must never mean "anyone may trigger the bot". No secret
// configured → the endpoint is off.
//
// Note also that src/proxy.ts excludes /api from the middleware matcher, so this
// route gets no session refresh and no centralised guard. It gates itself.
import { NextResponse } from 'next/server';
import { runFeedPoll } from '@/lib/pogo-feed/run';
import { isBotConfigured } from '@/lib/pogo-feed/post';

export const preferredRegion = 'dub1';

/**
 * Constant-time string compare, so a wrong secret can't be recovered by timing
 * the response. Same helper the notify-* Edge Functions use.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function POST(request: Request) {
  const secret = process.env.POGO_CRON_SECRET;

  // Fail closed: no secret configured means the endpoint is disabled, not open.
  if (!secret || !isBotConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const provided = request.headers.get('x-cron-secret') ?? '';
  if (!timingSafeEqual(provided, secret)) {
    // Deliberately no detail in the response and no secret in the log.
    console.warn('[pogo-feed] rejected a request with a bad cron secret');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const summary = await runFeedPoll();
    console.log(
      `[pogo-feed] events=${summary.eventsPosted} rotation=${summary.rotationPosted} ` +
        `seeded=${summary.seeded} notes=${summary.notes.join(',') || 'none'}`
    );
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error('[pogo-feed] run failed', err);
    return NextResponse.json({ error: 'run_failed' }, { status: 500 });
  }
}

// A stray GET (a browser, a crawler, an uptime check) should not look like a
// broken endpoint, and must not run the poll.
export function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
