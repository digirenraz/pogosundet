// Supabase Edge Function: notify-raid
//
// Triggered by a database webhook on INSERT into public.raids.
// Sends a web push notification to all subscribed users except the raid poster.
//
// DEPLOYMENT: Run manually with:
//   supabase functions deploy notify-raid
//
// WEBHOOK SETUP: In the Supabase dashboard go to:
//   Database → Webhooks → Create new webhook
//   - Table: public.raids
//   - Events: INSERT
//   - Type: HTTP Request
//   - URL: https://<project-ref>.supabase.co/functions/v1/notify-raid
//   - HTTP method: POST
//   - Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
//
// REQUIRED SECRETS (set via `supabase secrets set` or the Supabase dashboard):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails('mailto:renraz@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const raid = payload.record;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: subscriptions } = await supabase.from('push_subscriptions').select('*');

    if (!subscriptions?.length) return new Response('No subscribers', { status: 200 });

    // Exclude the poster from receiving a notification for their own raid
    const targets = subscriptions.filter((s: { user_id: string }) => s.user_id !== raid.user_id);

    const notification = JSON.stringify({
      title: `Nyt raid!${raid.boss_name ? ` ${raid.boss_name}` : ''}`,
      body: `${raid.gym_name ? `${raid.gym_name} — ` : ''}Tryk for at se detaljerne`,
      url: `/raids/${raid.id}`,
    });

    const sends = targets.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
      webpush
        .sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, notification)
        .catch(async (err: { statusCode?: number; body?: string; message?: string }) => {
          // 410 Gone means the subscription is no longer valid — clean it up
          if (err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            return;
          }
          // Anything else (401/403 from key mismatch, 400 bad request, etc.) used
          // to be silently swallowed. Log it so future regressions are debuggable.
          console.error('[notify-raid] send failed', {
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
