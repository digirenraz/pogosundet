// Posting as the bot.
//
// Uses the service-role client rather than a bot session. The INSERT policy on
// channel_messages is `auth.uid() = user_id`, which a service-role client
// bypasses — so no bot login, no refresh-token handling, no stored credential
// beyond the service key the app already holds.
//
// The row is otherwise completely ordinary: it lands in channel_messages, hits
// the supabase_realtime publication, and fans out to connected clients exactly
// like a human message. No client-side change was needed to display it.

import { createAdminClient } from '@/lib/supabase/admin';
import type { ChannelId } from '@/lib/chat/channels';

/**
 * The bot's auth user id.
 *
 * Set up once per Supabase project (see docs/plans/pogo-event-bot.md). Read from
 * the environment rather than hard-coded, because prod and pogosundet-preview
 * have different bot users.
 */
function botUserId(): string | null {
  return process.env.POGO_BOT_USER_ID || null;
}

/** Is the bot configured on this deployment? */
export function isBotConfigured(): boolean {
  return botUserId() !== null;
}

/**
 * Post one message as the bot.
 *
 * Returns { error } mirroring Supabase conventions. Callers post messages one at
 * a time and tolerate individual failures — a single failed post must not abort
 * the rest of the run.
 */
export async function postAsBot(
  channel: ChannelId,
  body: string
): Promise<{ error: unknown }> {
  const userId = botUserId();
  if (!userId) {
    return { error: 'bot_not_configured' };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('channel_messages')
    .insert({ channel, user_id: userId, body });

  if (error) {
    console.error(`[pogo-feed] failed to post to #${channel}: ${error.message}`);
  }

  return { error };
}
