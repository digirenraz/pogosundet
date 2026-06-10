// Server-only helpers for direct messages. Uses the server Supabase client
// (cookies-based, RLS-scoped). Do NOT import this from client components.
// Intentionally NOT cached — DMs must always reflect the latest state, and
// Realtime drives client updates separately.
import { createClient } from '@/lib/supabase/server';

export interface DMProfile {
  user_id: string;
  trainer_name: string;
  avatar_url: string | null;
  team: 'mystic' | 'valor' | 'instinct' | null;
  level: number | null;
  last_seen_at: string | null;
}

export interface DMReactionRow {
  emoji: string;
  user_id: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  reply_to_id: string | null;
  created_at: string;
  // Embedded via FK direct_messages_sender_profile_fk. Used for replies that
  // reference the sender of the original message (and for the rare case where a
  // chat row's profile changes between fetch and render).
  sender: { trainer_name: string; avatar_url: string | null } | null;
  reactions: DMReactionRow[];
}

// Lightweight shape used for the conversation list on /chat. One row per
// distinct partner the current user has exchanged DMs with, ordered by most
// recent message.
export interface DMConversationSummary {
  partner_id: string;
  partner: DMProfile | null;
  last_message: {
    body: string;
    created_at: string;
    sender_id: string;
  };
  unread_count: number;
}

// Fetch the messages between the current user and `partnerId`, oldest-first.
// Default limit 100 — infinite scroll-back is a follow-up.
export async function getMessagesForConversation(
  userId: string,
  partnerId: string,
  limit = 100
): Promise<DirectMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('direct_messages')
    .select(
      'id, sender_id, recipient_id, body, reply_to_id, created_at, sender:profiles!direct_messages_sender_profile_fk(trainer_name, avatar_url), reactions:direct_message_reactions(emoji, user_id)'
    )
    // Both directions of the pair — RLS already ensures the viewer is one of them.
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${userId})`
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown as DirectMessage[]).slice().reverse();
}

// Load the partner profile for a DM page header.
export async function getDMPartnerProfile(
  partnerId: string
): Promise<DMProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, trainer_name, avatar_url, team, level, last_seen_at')
    .eq('user_id', partnerId)
    .maybeSingle();
  if (error || !data) return null;
  return data as DMProfile;
}

// Conversation list for /chat. Returns one entry per distinct partner the
// current user has exchanged DMs with, ordered by latest message DESC. We pull
// up to 500 recent DMs (sent or received) and reduce client-side — simpler and
// faster than a per-partner round-trip while volume is small. Revisit if the
// table grows past a few thousand rows per user.
export async function getDMConversations(
  userId: string
): Promise<DMConversationSummary[]> {
  const supabase = await createClient();

  // 1. Recent messages (either direction) — capped, ordered newest-first.
  const { data: rows } = await supabase
    .from('direct_messages')
    .select('id, sender_id, recipient_id, body, created_at')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(500);

  const byPartner = new Map<
    string,
    { body: string; created_at: string; sender_id: string }
  >();
  for (const row of (rows ?? []) as Array<{
    sender_id: string;
    recipient_id: string;
    body: string;
    created_at: string;
  }>) {
    const partnerId = row.sender_id === userId ? row.recipient_id : row.sender_id;
    if (!byPartner.has(partnerId)) {
      byPartner.set(partnerId, {
        body: row.body,
        created_at: row.created_at,
        sender_id: row.sender_id,
      });
    }
  }

  if (byPartner.size === 0) return [];

  const partnerIds = Array.from(byPartner.keys());

  // 2+3. Partner profiles and dm_reads (for unread maths) in parallel — the
  // two queries are independent, so there's no reason to pay for them
  // sequentially.
  const [{ data: partnerRows }, { data: readsRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('user_id, trainer_name, avatar_url, team, level, last_seen_at')
      .in('user_id', partnerIds),
    supabase
      .from('dm_reads')
      .select('partner_id, last_read_at')
      .eq('user_id', userId),
  ]);

  const profileById = new Map<string, DMProfile>();
  for (const p of (partnerRows ?? []) as DMProfile[]) {
    profileById.set(p.user_id, p);
  }

  const readsByPartner = new Map<string, string>();
  for (const r of (readsRows ?? []) as Array<{
    partner_id: string;
    last_read_at: string;
  }>) {
    readsByPartner.set(r.partner_id, r.last_read_at);
  }

  // 4. Per-partner unread count — head count queries in parallel. Cheap because
  // each one is a single indexed count on a small partition.
  const summaries = await Promise.all(
    partnerIds.map(async (partnerId) => {
      const last = byPartner.get(partnerId)!;
      let q = supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', partnerId)
        .eq('recipient_id', userId);
      const since = readsByPartner.get(partnerId);
      if (since) q = q.gt('created_at', since);
      const { count } = await q;
      return {
        partner_id: partnerId,
        partner: profileById.get(partnerId) ?? null,
        last_message: last,
        unread_count: count ?? 0,
      } satisfies DMConversationSummary;
    })
  );

  summaries.sort(
    (a, b) =>
      new Date(b.last_message.created_at).getTime() -
      new Date(a.last_message.created_at).getTime()
  );
  return summaries;
}

// Upsert this user's last_read_at = NOW() for one partner. Called by the DM
// page on every visit so opening a conversation clears its badge.
export async function markDMRead(
  userId: string,
  partnerId: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('dm_reads')
    .upsert(
      {
        user_id: userId,
        partner_id: partnerId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,partner_id' }
    );
}
