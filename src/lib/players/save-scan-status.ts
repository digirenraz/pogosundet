import { createClient } from '@/lib/supabase/client';
import type { ScanStatus } from './scan-status';

// Browser-only writer for the desktop scan-session marks. Kept separate from
// the pure `scan-status.ts` so importing `buildScanStatusMap` server-side never
// pulls the browser Supabase client into the server bundle.
//
// Best-effort upsert of one mark. Fire-and-forget from the scan-session: a
// failed write never blocks the UI (the optimistic local state already moved
// on), and RLS guarantees the row is private to `userId`. `userId` is the
// session user, so it satisfies the auth.uid() = user_id policy.
export async function saveScanStatus(
  userId: string,
  targetUserId: string,
  status: ScanStatus
): Promise<void> {
  try {
    const supabase = createClient();
    await supabase
      .from('friend_scan_status')
      .upsert(
        { user_id: userId, target_user_id: targetUserId, status, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,target_user_id' }
      );
  } catch {
    // Network/RLS hiccup — ignore; the mark re-saves next time it's tapped.
  }
}
