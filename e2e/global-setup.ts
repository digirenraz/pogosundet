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
    await page.getByLabel(/E-mail/i).fill(email);
    await page.getByLabel(/Adgangskode/i).fill(password);
    await page.getByRole("button", { name: /^Log ind$/ }).click();

    // Allow up to 60 s — the DB may be finishing its cold start.
    await page.waitForURL(/\/players$/, { timeout: 60_000 });
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
