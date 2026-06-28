import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = "e2e/.auth/user.json";
const BASE_URL = "http://localhost:3000";

async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
  // Ping both the REST API and the GoTrue auth health endpoint.
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

    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/health`);
      console.log(`[global-setup] Auth warmup: ${res.status}`);
    } catch (e) {
      console.log(`[global-setup] Auth warmup failed: ${e}`);
    }
  }

  // If credentials are not configured, skip auth state creation — all
  // auth-gated tests will be skipped anyway.
  if (!email || !password) {
    console.log("[global-setup] No E2E credentials — auth state skipped");
    return;
  }

  // Ensure the auth state directory exists.
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Log in once via the real UI and save the session. All auth-gated tests
  // reuse this state instead of repeating the form login each time.
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/login`);
    console.log(`[global-setup] Navigated to login, URL: ${page.url()}`);

    await page.getByLabel(/E-mail/i).fill(email);
    await page.getByLabel(/Adgangskode/i).fill(password);
    await page.getByRole("button", { name: /^Log ind$/ }).click();
    console.log(`[global-setup] Clicked Log ind, waiting for /players...`);

    // Allow up to 60 s — the DB may be finishing its cold start.
    // Use Promise.race to detect wrong-credentials (login error stays on /login)
    // vs. slow redirect (navigation started but page load hangs).
    const result = await Promise.race([
      page.waitForURL(/\/players$/, { timeout: 60_000 }).then(() => "ok"),
      page.waitForURL(/\/profile\/setup$/, { timeout: 60_000 }).then(() => "no-profile"),
      // Detect a Supabase login error shown on the page.
      page.getByText(/Ugyldig|Invalid|forkert|incorrect|not found/i)
        .waitFor({ timeout: 60_000 })
        .then(() => "auth-error"),
    ]).catch((e) => {
      console.error(`[global-setup] Race timed out. URL: ${page.url()}`);
      throw e;
    });

    if (result === "no-profile") {
      throw new Error(
        `[global-setup] Login succeeded but redirected to /profile/setup — ` +
        `the test user has no profile row. Create one in the preview DB.`
      );
    }
    if (result === "auth-error") {
      const errText = await page.getByText(/Ugyldig|Invalid|forkert|incorrect|not found/i).innerText().catch(() => "(could not read error)");
      throw new Error(
        `[global-setup] Login failed — auth error on page: "${errText}". ` +
        `Check E2E_TEST_EMAIL / E2E_TEST_PASSWORD match a user on ${supabaseUrl}.`
      );
    }

    console.log(`[global-setup] Logged in as ${email}`);
    await page.context().storageState({ path: AUTH_FILE });
    console.log(`[global-setup] Auth state saved to ${AUTH_FILE}`);
  } catch (e) {
    console.error("[global-setup] Login failed:", e);
    throw e; // Fail loudly so CI shows the real reason.
  } finally {
    await browser.close();
  }
}

export default globalSetup;
