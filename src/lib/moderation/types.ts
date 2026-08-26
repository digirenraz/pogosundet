// Shared moderation types + constants. Imported by both client and server
// code, so this module must stay free of any Supabase client import.

// Which chat surface a reported message lives on. Mirrors the `surface` CHECK
// constraint in migration 024 and the branches of the report_message() RPC.
export type ReportSurface = 'channel' | 'raid' | 'dm';

// Why the message was reported. Mirrors the `reason` CHECK constraint.
// Order is the order shown in the report sheet.
export const REPORT_REASONS = [
  'harassment',
  'hate',
  'inappropriate',
  'spam',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

// Max length of the reporter's optional free-text note. Enforced as a
// `maxLength` on the textarea and mirrored by a DB CHECK (migration 024).
export const REPORT_NOTE_MAX_LENGTH = 500;

// Max length of the moderator's note (ban reason / warning text).
export const MODERATOR_NOTE_MAX_LENGTH = 1000;

// What a moderator can do with a report. Mirrors the actions accepted by the
// moderate_report() RPC.
export const MODERATION_ACTIONS = [
  'delete',
  'ban',
  'unban',
  'warn',
  'dismiss',
] as const;

export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

// A report row as rendered by the moderation screen. `message_body` is the
// server-side snapshot taken at report time, so it is still readable after the
// message itself has been deleted.
export interface MessageReport {
  id: string;
  surface: ReportSurface;
  message_id: string;
  context_id: string | null;
  reporter_id: string;
  reported_user_id: string;
  reason: ReportReason;
  note: string | null;
  message_body: string;
  message_sent_at: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  resolution: 'deleted' | 'banned' | 'unbanned' | 'warned' | 'dismissed' | null;
  moderator_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  /** Resolved trainer names + ban state, joined in by the server helper. */
  reporter_name: string;
  reported_user_name: string;
  reported_user_banned: boolean;
}

// Deep-link back to where a reported message was posted, so the moderator can
// see it in context before acting. DMs have no shareable URL (only the two
// participants may read the thread), so they return null.
export function reportContextHref(report: {
  surface: ReportSurface;
  context_id: string | null;
}): string | null {
  if (!report.context_id) return null;
  if (report.surface === 'channel') return `/chat/${report.context_id}`;
  if (report.surface === 'raid') return `/raids/${report.context_id}`;
  return null;
}
