// Client-side moderation helpers. Uses the browser Supabase client — never
// import this in Server Components.
import { createClient } from '@/lib/supabase/client';
import type { ReportReason, ReportSurface } from './types';

export type ReportResult =
  | { ok: true }
  /**
   * `reason` distinguishes the cases the UI words differently:
   *  - 'own_message'  the user tried to report themselves (shouldn't be
   *                   reachable — the sheet hides the action — but the RPC
   *                   enforces it, so handle the answer)
   *  - 'not_found'    the message was deleted between render and report
   *  - 'unknown'      anything else (network, RLS, server error)
   */
  | { ok: false; reason: 'own_message' | 'not_found' | 'unknown' };

// File a report against a single message.
//
// Everything that matters is decided server-side by the report_message() RPC:
// it resolves the message out of the right table, checks the caller is allowed
// to see it, and snapshots the body and author itself. We deliberately do NOT
// send the message text — a client-supplied body would let anyone fabricate a
// quote and get an innocent user banned.
//
// The RPC is idempotent, so reporting the same message twice succeeds quietly
// rather than erroring.
export async function reportMessage(
  surface: ReportSurface,
  messageId: string,
  reason: ReportReason,
  note: string | null = null
): Promise<ReportResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('report_message', {
    p_surface: surface,
    p_message_id: messageId,
    p_reason: reason,
    p_note: note,
  });

  if (!error) return { ok: true };

  // The RPC raises bare exception messages; map the ones the UI words
  // differently and fall back to a generic failure for everything else.
  const message = error.message ?? '';
  if (message.includes('cannot_report_own_message')) {
    return { ok: false, reason: 'own_message' };
  }
  if (message.includes('message_not_found')) {
    return { ok: false, reason: 'not_found' };
  }
  return { ok: false, reason: 'unknown' };
}
