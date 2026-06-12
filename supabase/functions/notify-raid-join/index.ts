// Supabase Edge Function: notify-raid-join
//
// Triggered by a database webhook on INSERT into public.raid_attendees.
// When a player joins a raid, sends a web push notification to every OTHER
// attendee — the host included (the poster is auto-joined at post time, so
// they're an attendee like anyone else) — never the player who just joined.
// Implements issue #103.
//
// The poster's own auto-join (fired when a raid is created) produces zero
// recipients — they're the only attendee at that moment — so it never sends a
// spurious notification. The "new raid posted" announcement is owned separately
// by notify-raid.
//
// DEPLOYMENT: Run manually with:
//   supabase functions deploy notify-raid-join
//
// WEBHOOK SETUP: In the Supabase dashboard go to:
//   Database → Webhooks → Create new webhook
//   - Table: public.raid_attendees
//   - Events: INSERT
//   - Type: HTTP Request
//   - URL: https://<project-ref>.supabase.co/functions/v1/notify-raid-join
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

    // Recipients: every OTHER attendee of this raid — never the player who just
    // joined. The host is an attendee (auto-joined at post time), so this single
    // query covers "host + other participants" with no special-casing.
    const { data: attendees } = await supabase
      .from('raid_attendees')
      .select('user_id')
      .eq('raid_id', record.raid_id)
      .neq('user_id', record.user_id);

    if (!attendees?.length) return new Response('No recipients', { status: 200 });

    const recipientIds = attendees.map((a: { user_id: string }) => a.user_id);

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', recipientIds);

    if (!subscriptions?.length) return new Response('No subscribers', { status: 200 });

    // The joiner's display name + the raid's boss/gym for context — both are
    // already public raid/profile metadata (trainer names are shown throughout
    // the app), so this leaks no new personal data.
    const [{ data: joiner }, { data: raid }] = await Promise.all([
      supabase.from('profiles').select('trainer_name').eq('user_id', record.user_id).single(),
      supabase.from('raids').select('boss_name, gym_name').eq('id', record.raid_id).single(),
    ]);

    const raidContext: string | null = raid?.boss_name || raid?.gym_name || null;
    const joinerName: string | null = joiner?.trainer_name || null;

    // type: 'raid-join' is a transient announcement (like 'raid'), NOT an unread
    // message, so the service worker shows it but never bumps the home-screen
    // icon badge (only 'dm'/'raid-message' do). Foreground suppression against
    // /raids/<id> is handled generically by the SW, so no SW change was needed.
    const notification = JSON.stringify({
      type: 'raid-join',
      title: `Ny deltager${raidContext ? `: ${raidContext}` : ''}`,
      body: joinerName ? `${joinerName} er med i raidet` : 'En ny spiller er med i raidet',
      url: `/raids/${record.raid_id}`,
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
          console.error('[notify-raid-join] send failed', {
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
