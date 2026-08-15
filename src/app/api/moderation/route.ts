// POST /api/moderation
// Acts on a message report: delete the message, ban/unban its author, send a
// warning DM, or dismiss the report.
//
// Authorisation is enforced TWICE on purpose. This handler checks is_admin
// before doing anything, and the moderate_report() RPC checks it again in the
// database — so even a bug here (or any other caller reaching the RPC directly)
// can't act on a report without moderator rights.
//
// Responses:
//   200 { ok: true }               — action applied
//   400 { error: 'invalid' }       — malformed JSON or failed validation
//   401 { error: 'unauthorized' }  — no session
//   403 { error: 'forbidden' }     — signed in, but not a moderator
//   404 { error: 'not_found' }     — no such report
//   500 { error: 'failed' }        — the RPC errored
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateModeration } from '@/lib/moderation/validation';

export const preferredRegion = 'dub1';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // is_admin() is argument-less and SECURITY DEFINER — it answers only about
  // the caller, and profiles.is_admin is not directly selectable (migration 023).
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const { reportId, action, note } = (body ?? {}) as {
    reportId?: unknown;
    action?: unknown;
    note?: unknown;
  };
  const result = validateModeration({
    reportId: typeof reportId === 'string' ? reportId : '',
    action: typeof action === 'string' ? action : '',
    note: typeof note === 'string' ? note : undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  // A warning is delivered as a real DM from the moderator's own account, so
  // the user can reply to a person rather than to a system address. Sent
  // BEFORE the RPC records the outcome: if the DM fails we don't want the
  // report marked "warned" when no warning was actually delivered.
  if (result.action === 'warn') {
    const { data: report, error: reportError } = await supabase
      .from('message_reports')
      .select('reported_user_id')
      .eq('id', result.reportId)
      .maybeSingle();

    if (reportError || !report) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const { error: dmError } = await supabase.from('direct_messages').insert({
      sender_id: userId,
      recipient_id: report.reported_user_id,
      body: result.note,
    });
    if (dmError) {
      console.error('Moderation: warning DM failed', dmError.message);
      return NextResponse.json({ error: 'failed' }, { status: 500 });
    }
  }

  const { error } = await supabase.rpc('moderate_report', {
    p_report_id: result.reportId,
    p_action: result.action,
    p_note: result.note,
  });

  if (error) {
    if ((error.message ?? '').includes('report_not_found')) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error('Moderation: moderate_report failed', error.message);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
