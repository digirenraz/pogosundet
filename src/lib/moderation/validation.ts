// Validation for moderation payloads — the single source of truth used by BOTH
// the client (ReportSheet / ModerationScreen, to enable the submit button) and
// the server (/api/moderation, to reject bad payloads with 400). Pure
// functions, no I/O.

import {
  MODERATION_ACTIONS,
  MODERATOR_NOTE_MAX_LENGTH,
  REPORT_NOTE_MAX_LENGTH,
  REPORT_REASONS,
  type ModerationAction,
  type ReportReason,
  type ReportSurface,
} from './types';

export interface ReportInput {
  surface: string;
  messageId: string;
  reason: string;
  note?: string;
}

export type ReportValidation =
  /** Valid — the normalised values to actually send. */
  | {
      ok: true;
      surface: ReportSurface;
      messageId: string;
      reason: ReportReason;
      note: string | null;
    }
  /** Invalid — `error` names the first offending field. */
  | { ok: false; error: 'surface' | 'messageId' | 'reason' | 'note' };

const SURFACES: readonly string[] = ['channel', 'raid', 'dm'];

// A message id is always a UUID from the database. Optimistic placeholders use
// an `opt-` prefix and are explicitly not reportable — they don't exist server
// side yet, so report_message() would reject them anyway.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateReport(input: ReportInput): ReportValidation {
  if (!SURFACES.includes(input.surface)) {
    return { ok: false, error: 'surface' };
  }
  if (!UUID_RE.test(input.messageId ?? '')) {
    return { ok: false, error: 'messageId' };
  }
  if (!(REPORT_REASONS as readonly string[]).includes(input.reason)) {
    return { ok: false, error: 'reason' };
  }

  const note = (input.note ?? '').trim();
  if (note.length > REPORT_NOTE_MAX_LENGTH) {
    return { ok: false, error: 'note' };
  }

  return {
    ok: true,
    surface: input.surface as ReportSurface,
    messageId: input.messageId,
    reason: input.reason as ReportReason,
    note: note.length > 0 ? note : null,
  };
}

export interface ModerationInput {
  reportId: string;
  action: string;
  note?: string;
}

export type ModerationValidation =
  | { ok: true; reportId: string; action: ModerationAction; note: string | null }
  | { ok: false; error: 'reportId' | 'action' | 'note' };

export function validateModeration(
  input: ModerationInput
): ModerationValidation {
  if (!UUID_RE.test(input.reportId ?? '')) {
    return { ok: false, error: 'reportId' };
  }
  if (!(MODERATION_ACTIONS as readonly string[]).includes(input.action)) {
    return { ok: false, error: 'action' };
  }

  const note = (input.note ?? '').trim();
  if (note.length > MODERATOR_NOTE_MAX_LENGTH) {
    return { ok: false, error: 'note' };
  }

  // A warning is a DM sent to the user — an empty one would be meaningless.
  if (input.action === 'warn' && note.length === 0) {
    return { ok: false, error: 'note' };
  }

  return {
    ok: true,
    reportId: input.reportId,
    action: input.action as ModerationAction,
    note: note.length > 0 ? note : null,
  };
}
