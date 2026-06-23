import { createClient } from '@/lib/supabase/client';

// Desktop scan-session marks (see DesktopPlayers): the user works down the QR
// queue tapping "Tilføjet → næste" / "Spring over". Persisted per-user, private
// to the owner (RLS), in `friend_scan_status` (migration 021).
export type ScanStatus = 'added' | 'skipped';

export interface ScanStatusRow {
  target_user_id: string;
  status: ScanStatus;
}

// Pure: turn the DB rows into a map keyed by the target player's user_id.
// Defensive against malformed rows (bad status, duplicates) so a single odd row
// can't break the directory render.
export function buildScanStatusMap(
  rows: ScanStatusRow[] | null | undefined
): Record<string, ScanStatus> {
  const map: Record<string, ScanStatus> = {};
  for (const r of rows ?? []) {
    if (r && (r.status === 'added' || r.status === 'skipped')) {
      map[r.target_user_id] = r.status;
    }
  }
  return map;
}

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
