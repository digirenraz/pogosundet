// Server-only moderation helpers. Uses the server Supabase client (cookies), so
// every read is authorised by the caller's own session — the "Admins can read
// reports" RLS policy is what actually keeps the queue private, not this code.
// Do NOT import from client components.
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { MessageReport } from './types';

// Shape returned by the embedded select below, before flattening.
interface ReportRow {
  id: string;
  surface: MessageReport['surface'];
  message_id: string;
  context_id: string | null;
  reporter_id: string;
  reported_user_id: string;
  reason: MessageReport['reason'];
  note: string | null;
  message_body: string;
  message_sent_at: string | null;
  status: MessageReport['status'];
  resolution: MessageReport['resolution'];
  moderator_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  reporter: { trainer_name: string } | null;
  reported: { trainer_name: string } | null;
}

// message_reports has TWO FKs into profiles, so each embed must name its
// constraint explicitly or PostgREST can't tell them apart.
const REPORT_SELECT = `
  id, surface, message_id, context_id, reporter_id, reported_user_id,
  reason, note, message_body, message_sent_at,
  status, resolution, moderator_note, reviewed_at, created_at,
  reporter:profiles!message_reports_reporter_profile_fk(trainer_name),
  reported:profiles!message_reports_reported_profile_fk(trainer_name)
`;

function toMessageReport(
  row: ReportRow,
  bannedUserIds: Set<string>
): MessageReport {
  return {
    id: row.id,
    surface: row.surface,
    message_id: row.message_id,
    context_id: row.context_id,
    reporter_id: row.reporter_id,
    reported_user_id: row.reported_user_id,
    reason: row.reason,
    note: row.note,
    message_body: row.message_body,
    message_sent_at: row.message_sent_at,
    status: row.status,
    resolution: row.resolution,
    moderator_note: row.moderator_note,
    reviewed_at: row.reviewed_at,
    created_at: row.created_at,
    reporter_name: row.reporter?.trainer_name ?? '—',
    reported_user_name: row.reported?.trainer_name ?? '—',
    reported_user_banned: bannedUserIds.has(row.reported_user_id),
  };
}

// Is the signed-in user a moderator? Used to gate the /admin route and to
// decide whether to show the "Moderation" entry in the app menu.
//
// Returns false for signed-out users rather than throwing — callers treat this
// as "not a moderator" and 404 the route, which also avoids confirming that a
// moderation screen exists at all.
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();

  // Via the RPC rather than a column select: migration 023 revokes SELECT on
  // profiles.is_admin from `authenticated` (so nobody can look up who the
  // moderator is), and is_admin() takes no argument, so it can only ever
  // answer about the caller. Returns false when signed out — callers treat
  // that as "not a moderator" and 404 the route.
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return data === true;
}

// The moderation queue. Pending reports first (that's the work), then the most
// recent resolved/dismissed ones as a history tail.
//
// Returns [] on any error — including the RLS denial a non-admin gets — so a
// misconfigured caller renders an empty queue instead of leaking a stack trace.
export async function getReports(historyLimit = 30): Promise<{
  pending: MessageReport[];
  history: MessageReport[];
}> {
  const supabase = await createClient();

  const [pendingResult, historyResult] = await Promise.all([
    supabase
      .from('message_reports')
      .select(REPORT_SELECT)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('message_reports')
      .select(REPORT_SELECT)
      .neq('status', 'pending')
      .order('reviewed_at', { ascending: false })
      .limit(historyLimit),
  ]);

  if (pendingResult.error || historyResult.error) {
    console.error('Moderation: failed to load reports', {
      pending: pendingResult.error?.message,
      history: historyResult.error?.message,
    });
  }

  const pendingRows = (pendingResult.data ?? []) as unknown as ReportRow[];
  const historyRows = (historyResult.data ?? []) as unknown as ReportRow[];

  // Ban state is fetched separately, through the ADMIN client, because
  // migration 023 revokes SELECT on profiles.banned_at from `authenticated` —
  // otherwise any member could enumerate who is banned. It can't come from the
  // embedded join above for the same reason. Scoped to just the users who
  // actually appear in the queue, and only reached after the /admin page has
  // already verified the caller is a moderator.
  const reportedIds = Array.from(
    new Set([...pendingRows, ...historyRows].map((r) => r.reported_user_id))
  );

  const bannedUserIds = new Set<string>();
  if (reportedIds.length > 0) {
    const admin = createAdminClient();
    const { data: banRows, error: banError } = await admin
      .from('profiles')
      .select('user_id, banned_at')
      .in('user_id', reportedIds)
      .not('banned_at', 'is', null);
    if (banError) {
      // Non-fatal: the queue still renders, just without the "Udelukket"
      // badge. Losing a badge is much better than losing the whole screen.
      console.error('Moderation: failed to load ban state', banError.message);
    }
    for (const row of banRows ?? []) bannedUserIds.add(row.user_id as string);
  }

  return {
    pending: pendingRows.map((row) => toMessageReport(row, bannedUserIds)),
    history: historyRows.map((row) => toMessageReport(row, bannedUserIds)),
  };
}

// Count of unreviewed reports — drives the badge on the app-menu entry.
export async function getPendingReportCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('message_reports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) return 0;
  return count ?? 0;
}
