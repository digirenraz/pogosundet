// Supabase Edge Function: notify-report
//
// Triggered by a database webhook on INSERT into public.message_reports.
// Sends a web push notification to every moderator (profiles.is_admin = true)
// so a report is seen quickly rather than whenever someone next opens /admin.
//
// DEPLOYMENT: Run manually with:
//   supabase functions deploy notify-report
//
// WEBHOOK SETUP: In the Supabase dashboard go to:
//   Database → Webhooks → Create new webhook
//   - Table: public.message_reports
//   - Events: INSERT
//   - Type: HTTP Request
//   - URL: https://<project-ref>.supabase.co/functions/v1/notify-report
//   - HTTP method: POST
//   - Headers:
//       Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
//       x-webhook-secret: <WEBHOOK_SECRET>   (enables the caller-auth gate below)
//
// REQUIRED SECRETS (set via `supabase secrets set` or the Supabase dashboard):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// OPTIONAL SECRET:
//   WEBHOOK_SECRET — when set, the function rejects any call whose
//   `x-webhook-secret` header doesn't match. Unset = fail-open (no enforcement),
//   so deploying never breaks delivery. Set it ONLY AFTER the header is added to
//   every webhook, then redeploy, to avoid a rejection window.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails('mailto:renraz@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Caller-auth gate (security review Finding 1). FAIL-OPEN until configured: if
// WEBHOOK_SECRET is unset the check is skipped, so deploying this code can never
// break push delivery. Once the secret is set (and the function redeployed), any
// caller that doesn't present a matching `x-webhook-secret` header is rejected —
// closing the hole where the public anon key alone could trigger forged pushes.
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

function isAuthorizedCaller(req: Request): boolean {
  if (!WEBHOOK_SECRET) return true; // not configured yet → allow
  const provided = req.headers.get('x-webhook-secret') ?? '';
  return timingSafeEqual(provided, WEBHOOK_SECRET);
}

// Constant-time comparison — avoids leaking the secret via response timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req: Request) => {
  try {
    if (!isAuthorizedCaller(req)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const payload = await req.json();
    const record = payload.record;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Every moderator gets the alert. There is normally exactly one, but the
    // is_admin flag is designed to be grantable to a second person later.
    const { data: admins } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('is_admin', true);

    if (!admins?.length) return new Response('No admins', { status: 200 });

    const adminIds = admins.map((a: { user_id: string }) => a.user_id);

    // Never notify a moderator about their own report — they just filed it.
    const targetIds = adminIds.filter((id: string) => id !== record.reporter_id);
    if (!targetIds.length) return new Response('No subscribers', { status: 200 });

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', targetIds);

    if (!subscriptions?.length) return new Response('No subscribers', { status: 200 });

    // GDPR-minimising payload: NEVER the reported message text, and no trainer
    // names — a moderation alert on a lock screen shouldn't name the accused.
    // The moderator opens /admin to see the actual report.
    const notification = JSON.stringify({
      type: 'report',
      title: 'Ny anmeldelse',
      body: 'En besked er blevet anmeldt',
      url: '/admin',
    });

    const sends = subscriptions.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
      webpush
        .sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, notification)
        .catch(async (err: { statusCode?: number; body?: string; message?: string }) => {
          // 410 Gone means the subscription is no longer valid — clean it up
          if (err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            return;
          }
          console.error('[notify-report] send failed', {
            endpoint: sub.endpoint,
            statusCode: err.statusCode,
            message: err.message,
            body: err.body,
          });
        })
    );

    await Promise.allSettled(sends);
    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response('Error', { status: 500 });
  }
});
