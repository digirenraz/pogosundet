// POST /api/profile/revalidate
// Busts the cached player directory (`getAllProfiles`, tag 'profiles') after a
// profile edit, so changes that affect what OTHER users see — notably the
// "hide my friend code" toggle (issue #101) — propagate immediately instead of
// waiting up to the 60s cache TTL. Mirrors the revalidateTag call in
// /api/account/delete. Requires an authenticated caller; the edit itself is
// still done client-side under RLS, this only refreshes the shared cache.
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export const preferredRegion = 'dub1';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  revalidateTag('profiles', 'max');

  return NextResponse.json({ success: true });
}
