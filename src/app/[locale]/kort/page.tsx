import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LiveLocationScreen } from '@/components/LiveLocationScreen';

// Supabase EU region — keep queries in Dublin (see CLAUDE.md).
export const preferredRegion = 'dub1';

// "Hvem spiller nu" — live location sharing.
//
// The share list itself is fetched client-side through the get_live_locations()
// RPC rather than here: it changes by the minute and arrives over Realtime
// anyway, so a server fetch would only ever render a snapshot that is stale
// before it paints.
export default async function KortPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) redirect('/login');

  return <LiveLocationScreen currentUserId={userId} />;
}
