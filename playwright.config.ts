import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // Two projects, routed by test tag (report #10):
  //  • mobile-chrome (Pixel 7) is the DEFAULT — it runs every test NOT tagged
  //    @desktop. Most of the app is mobile-first and the lg: breakpoints must
  //    behave as mobile here; a desktop-only viewport once hid a mobile-only
  //    regression (the changelog/bug-report sheet behind the bottom nav).
  //  • desktop-chrome (Desktop Chrome) runs ONLY @desktop-tagged tests — the
  //    handful that assert the lg+ sidebar / scan-session layout. They need a
  //    real desktop context (no mobile emulation / isMobile flag).
  // Tag a desktop test with: test("…", { tag: "@desktop" }, async …) — or tag
  // a whole describe block. Untagged tests run once (mobile); tagged once
  // (desktop) — no duplication.
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      grepInvert: /@desktop/,
    },
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
      grep: /@desktop/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
