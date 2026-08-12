// Server-only moderation helpers. Uses the server Supabase client (cookies), so
// every read is authorised by the caller's own session — the "Admins can read
// reports" RLS policy is what actually keeps the queue private, not this code.
// Do NOT import from client components.
import { createClient } from '@/lib/supabase/server';
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
  reported: { trainer_name: string; banned_at: string | null } | null;
}

// message_reports has TWO FKs into profiles, so each embed must name its
// constraint explicitly or PostgREST can't tell them apart.
const REPORT_SELECT = `
  id, surface, message_id, context_id, reporter_id, reported_user_id,
  reason, note, message_body, message_sent_at,
  status, resolution, moderator_note, reviewed_at, created_at,
  reporter:profiles!message_reports_reporter_profile_fk(trainer_name),
  reported:profiles!message_reports_reported_profile_fk(trainer_name, banned_at)
`;

function toMessageReport(row: ReportRow): MessageReport {
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
    reported_user_banned: row.reported?.banned_at != null,
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
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) return false;

  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return false;
  return data.is_admin === true;
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

  return {
    pending: ((pendingResult.data ?? []) as unknown as ReportRow[]).map(
      toMessageReport
    ),
    history: ((historyResult.data ?? []) as unknown as ReportRow[]).map(
      toMessageReport
    ),
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
