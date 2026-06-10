// Validation for in-app bug reports — the single source of truth used by BOTH
// the client form (src/components/BugReportSheet.tsx, to enable the send
// button) and the server route (src/app/api/bug-report/route.ts, to reject
// bad payloads with 400). Pure function, no I/O.

export const BUG_REPORT_TITLE_MIN = 3;
export const BUG_REPORT_TITLE_MAX = 100;
export const BUG_REPORT_DESCRIPTION_MIN = 10;
export const BUG_REPORT_DESCRIPTION_MAX = 2000;

export interface BugReportInput {
  title: string;
  description: string;
}

export type BugReportValidation =
  /** Valid — `title`/`description` are the trimmed values to actually send. */
  | { ok: true; title: string; description: string }
  /** Invalid — `error` names the first offending field (title checked first). */
  | { ok: false; error: 'title' | 'description' };

export function validateBugReport(input: BugReportInput): BugReportValidation {
  const title = (input.title ?? '').trim();
  const description = (input.description ?? '').trim();

  if (title.length < BUG_REPORT_TITLE_MIN || title.length > BUG_REPORT_TITLE_MAX) {
    return { ok: false, error: 'title' };
  }
  if (
    description.length < BUG_REPORT_DESCRIPTION_MIN ||
    description.length > BUG_REPORT_DESCRIPTION_MAX
  ) {
    return { ok: false, error: 'description' };
  }
  return { ok: true, title, description };
}
