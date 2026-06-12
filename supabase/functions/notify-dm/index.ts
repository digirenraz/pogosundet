// Supabase Edge Function: notify-dm
//
// Triggered by a database webhook on INSERT into public.direct_messages.
// Sends a web push notification to the message recipient only.
//
// DEPLOYMENT: Run manually with:
//   supabase functions deploy notify-dm
//
// WEBHOOK SETUP: In the Supabase dashboard go to:
//   Database → Webhooks → Create new webhook
//   - Table: public.direct_messages
//   - Events: INSERT
//   - Type: HTTP Request
//   - URL: https://<project-ref>.supabase.co/functions/v1/notify-dm
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
    const record = payload.record;

    // Defensive guard: never notify yourself for a message you sent to yourself.
    if (record.recipient_id === record.sender_id) {
      return new Response('No subscribers', { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Target ONLY the recipient's push subscriptions.
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', record.recipient_id);

    if (!subscriptions?.length) return new Response('No subscribers', { status: 200 });

    // Look up the sender's display name for the notification title.
    const { data: sender } = await supabase
      .from('profiles')
      .select('trainer_name')
      .eq('user_id', record.sender_id)
      .single();

    // GDPR-minimising payload: sender name only, NEVER the message content.
    const notification = JSON.stringify({
      type: 'dm',
      title: sender?.trainer_name || 'Ny besked',
      body: 'Ny besked',
      url: `/chat/dm/${record.sender_id}`,
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
          // Anything else (401/403 from key mismatch, 400 bad request, etc.) used
          // to be silently swallowed. Log it so future regressions are debuggable.
          console.error('[notify-dm] send failed', {
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
