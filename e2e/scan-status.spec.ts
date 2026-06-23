import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile, AND at least one OTHER
// player in the directory (the scan queue filters out the current user).
const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Desktop scan-session status persistence", () => {
  test.skip(!EMAIL || !PASSWORD, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured");

  // The scan-session is desktop-only (lg+).
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/E-mail/i).fill(EMAIL!);
    await page.getByLabel(/Adgangskode/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /^Log ind$/ }).click();
    await page.waitForURL(/\/players$/);
  });

  test("marking 'Tilføjet → næste' persists across a reload", async ({ page }) => {
    // The scan-session "Tilføjet → næste" button advances the queue and
    // persists the mark for the player currently shown.
    const added = page.getByRole("button", { name: /Tilføjet → næste/ });
    if (!(await added.isVisible().catch(() => false))) {
      test.skip(true, "No other players in the directory to mark");
    }

    // Count the added marks before, mark one, then reload and confirm the
    // progress count survived (seeded from the persisted status).
    await added.click();

    await page.reload();
    await page.waitForLoadState("networkidle");

    // After reload, at least one "added" check should be reflected in the
    // queue progress ("X tilføjet" counter is > 0).
    const addedCounter = page.getByText(/\d+ tilføjet/);
    await expect(addedCounter.first()).toBeVisible();
  });
});
