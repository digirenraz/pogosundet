// Server-only helpers for DM unread counts. Mirrors src/lib/chat/read-helpers.ts.
// Do NOT import this from client components.
import { createClient } from '@/lib/supabase/server';

// Per-partner unread count for `userId`. The map key is the partner's user_id.
// A missing dm_reads row means the user has never opened that conversation —
// every incoming message counts as unread.
export async function getUnreadCountsForUser(
  userId: string
): Promise<Record<string, number>> {
  const supabase = await createClient();

  // Distinct partners who have sent us at least one DM.
  const { data: senders } = await supabase
    .from('direct_messages')
    .select('sender_id')
    .eq('recipient_id', userId)
    .limit(500);
  const partnerIds = Array.from(
    new Set((senders ?? []).map((r: { sender_id: string }) => r.sender_id))
  );
  if (partnerIds.length === 0) return {};

  const { data: reads } = await supabase
    .from('dm_reads')
    .select('partner_id, last_read_at')
    .eq('user_id', userId);
  const readsByPartner = new Map<string, string>();
  for (const r of (reads ?? []) as Array<{
    partner_id: string;
    last_read_at: string;
  }>) {
    readsByPartner.set(r.partner_id, r.last_read_at);
  }

  const counts = await Promise.all(
    partnerIds.map(async (partnerId) => {
      let q = supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', partnerId)
        .eq('recipient_id', userId);
      const since = readsByPartner.get(partnerId);
      if (since) q = q.gt('created_at', since);
      const { count } = await q;
      return [partnerId, count ?? 0] as const;
    })
  );

  return Object.fromEntries(counts);
}

// Total unread across all DM conversations — used by the BottomNav badge.
export async function getUnreadDMTotal(userId: string): Promise<number> {
  const counts = await getUnreadCountsForUser(userId);
  let total = 0;
  for (const n of Object.values(counts)) total += n;
  return total;
}
