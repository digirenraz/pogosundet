// Playwright global setup — runs once before all tests.
//
// Free-tier Supabase projects pause after inactivity. The first DB query after
// a cold start can take 20-30s, which exceeds the per-test timeout and causes
// every auth-gated spec to fail on the first run of the day.
//
// This fires a lightweight REST query against the profiles table to wake the DB
// before any test starts, so the timeout never hits a cold-start mid-test.
// No-ops gracefully when env vars are absent (Dependabot runs, local runs
// without creds).
async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  try {
    await fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
  } catch {
    // Non-fatal — tests will still run; the first auth test may be slow.
  }
}

export default globalSetup;
