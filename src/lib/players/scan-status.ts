// Pure scan-status helpers + types (no Supabase import, so the server page can
// import `buildScanStatusMap` without pulling the browser client into the
// server bundle — keeps the "three clients, never mix" boundary clean). The
// browser-only `saveScanStatus` lives in `save-scan-status.ts`.
//
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
