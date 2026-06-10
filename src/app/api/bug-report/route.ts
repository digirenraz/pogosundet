// POST /api/bug-report
// Creates a GitHub issue in the private repo from a user-submitted bug report.
// The GitHub token is a server-only secret, so issue creation MUST happen here
// — never in the browser. Mirrors /api/account/delete for the handler shape.
//
// Responses:
//   201 { ok: true }                 — issue created
//   400 { error: 'invalid' }         — malformed JSON or failed validation
//   401 { error: 'unauthorized' }    — no session
//   502 { error: 'github_failed' }   — GitHub answered non-2xx
//   503 { error: 'not_configured' }  — GITHUB_BUG_REPORT_TOKEN not set
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateBugReport } from '@/lib/bug-report/validation';

export const preferredRegion = 'dub1';

const GITHUB_ISSUES_URL = 'https://api.github.com/repos/digirenraz/pogosundet/issues';

export async function POST(request: Request) {
  const supabase = await createClient();

  // Verify the caller is authenticated.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Parse the body defensively — malformed JSON is a client error, not a crash.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const { title, description } = (body ?? {}) as { title?: unknown; description?: unknown };
  const result = validateBugReport({
    title: typeof title === 'string' ? title : '',
    description: typeof description === 'string' ? description : '',
  });
  if (!result.ok) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  // Like Sentry/Amplitude, the feature no-ops without its key.
  const token = process.env.GITHUB_BUG_REPORT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  // Attribute the report to the reporter's (already public) trainer name.
  const { data: profile } = await supabase
    .from('profiles')
    .select('trainer_name')
    .eq('user_id', userId)
    .maybeSingle();
  const trainerName = profile?.trainer_name || 'ukendt';

  const githubResponse = await fetch(GITHUB_ISSUES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: result.title,
      body: `${result.description}\n\n---\nRapporteret af **${trainerName}** via appen.`,
      labels: ['user-report'],
    }),
  });

  if (!githubResponse.ok) {
    // Log the status + a snippet of GitHub's answer for debugging — NEVER the token.
    const text = await githubResponse.text().catch(() => '');
    console.error(
      `Bug report: GitHub issue creation failed with ${githubResponse.status}: ${text.slice(0, 200)}`
    );
    return NextResponse.json({ error: 'github_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
