// POST /api/account/delete
// Verifies the caller's session, then permanently deletes their auth user.
// The profiles row is removed automatically via ON DELETE CASCADE.
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { deleteAccount } from '@/lib/account/server-helpers';

export const preferredRegion = 'dub1';

export async function POST() {
  const supabase = await createClient();

  // Verify the caller is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await deleteAccount(user.id);
  if (error) {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }

  // Bust the profiles cache immediately so the deleted user's card doesn't linger.
  revalidateTag('profiles', 'max');

  return NextResponse.json({ success: true });
}
