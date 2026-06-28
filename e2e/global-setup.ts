import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = "e2e/.auth/user.json";
const BASE_URL = "http://localhost:3000";

async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  // Diagnostic: log which Supabase host CI is targeting.
  if (supabaseUrl) {
    try {
      const host = new URL(supabaseUrl).hostname;
      console.log(`[global-setup] Supabase: ${host}`);
    } catch {
      console.log(`[global-setup] Supabase URL: ${supabaseUrl}`);
    }
  }

  // Warm up the Supabase DB (free-tier projects sleep after inactivity).
  if (supabaseUrl && serviceRoleKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/profiles?select=id&limit=1`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }
      );
      console.log(`[global-setup] REST warmup: ${res.status}`);
    } catch (e) {
      console.log(`[global-setup] REST warmup failed: ${e}`);
    }
  }

  if (!email || !password) {
    console.log("[global-setup] No E2E credentials — auth state skipped");
    return;
  }

  // Step 1: Verify credentials via direct API call (no browser). This gives
  // an immediate, unambiguous answer on whether the secret values are correct —
  // before we even launch a browser.
  if (!supabaseUrl || !anonKey) {
    throw new Error("[global-setup] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing");
  }

  console.log(`[global-setup] Checking credentials for ${email} via API...`);
  const apiRes = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    }
  );
  const apiData = await apiRes.json();
  if (!apiRes.ok) {
    throw new Error(
      `[global-setup] API login failed (${apiRes.status}): ${JSON.stringify(apiData)}\n` +
        `  → Check E2E_TEST_EMAIL / E2E_TEST_PASSWORD match a user on ${supabaseUrl}`
    );
  }
  console.log(`[global-setup] API login OK for ${email} (user: ${apiData.user?.id})`);

  // Step 2: Open a browser, set the session cookies directly from the API
  // tokens, and navigate to /players to let the middleware set the profile
  // guard cookie. Then save the full storage state.
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();

    // Build the Supabase session payload and encode it the way @supabase/ssr
    // expects: "base64-" prefix + base64url(JSON.stringify(session)).
    const session = {
      access_token: apiData.access_token,
      token_type: "bearer",
      expires_in: apiData.expires_in,
      expires_at: apiData.expires_at,
      refresh_token: apiData.refresh_token,
      user: apiData.user,
    };
    const encoded =
      "base64-" +
      Buffer.from(JSON.stringify(session))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

    // Supabase SSR splits large cookies into chunks (.0, .1, …). The session
    // JSON is typically ~2 KB — well under the 4 KB cookie limit — so a single
    // cookie suffices. If it ever needs chunking, Supabase will re-chunk on
    // the next server response, so setting one cookie here is safe.
    await context.addCookies([
      {
        name: `sb-${projectRef}-auth-token`,
        value: encoded,
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage();
    // Navigate to /players; the middleware will verify the session and set the
    // pogo-profile-ok guard cookie. waitForURL gives 30 s — if it redirects to
    // /profile/setup, the test user has no profile row.
    await page.goto(`${BASE_URL}/players`, { waitUntil: "networkidle" });

    const finalUrl = page.url();
    console.log(`[global-setup] After /players navigation: ${finalUrl}`);

    if (finalUrl.includes("/profile/setup")) {
      throw new Error(
        `[global-setup] Login succeeded but middleware redirected to /profile/setup — ` +
          `the test user (${email}) has no profile row on ${supabaseUrl}. ` +
          `INSERT one into public.profiles.`
      );
    }
    if (!finalUrl.includes("/players")) {
      throw new Error(
        `[global-setup] Unexpected URL after /players navigation: ${finalUrl}`
      );
    }

    // Dismiss the Amplitude consent banner if present. It's a fixed z-50 overlay
    // that intercepts pointer events, so any test that clicks anything will time
    // out unless consent was already answered. Dismissing here saves the choice
    // in localStorage via storageState, so all tests start with it gone.
    const consentBanner = page.getByRole("dialog", { name: /Samtykke til analyse/ });
    try {
      await consentBanner.waitFor({ state: "visible", timeout: 5000 });
      await page.getByRole("button", { name: /Afvis/ }).click();
      await consentBanner.waitFor({ state: "hidden", timeout: 5000 });
      console.log("[global-setup] Consent banner dismissed");
    } catch {
      console.log("[global-setup] No consent banner — skipping dismissal");
    }

    await context.storageState({ path: AUTH_FILE });
    console.log(`[global-setup] Auth state saved to ${AUTH_FILE}`);
  } catch (e) {
    console.error("[global-setup] Failed:", e);
    throw e;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
