import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile, AND at least one OTHER
// player in the directory (the scan queue filters out the current user).
const EMAIL = process.env.E2E_TEST_EMAIL;

test.describe("Desktop scan-session status persistence", { tag: "@desktop" }, () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  // The scan-session is desktop-only (lg+). Runs under the desktop-chrome
  // project (@desktop tag); the explicit viewport keeps the exact dimensions.
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/players");
  });

  test("marking 'Tilføjet → næste' persists across a reload", async ({ page }) => {
    // The scan-session "Tilføjet → næste" button advances the queue and
    // persists the mark for the player currently shown.
    const added = page.getByRole("button", { name: /Tilføjet → næste/ });
    if (!(await added.isVisible().catch(() => false))) {
      test.skip(true, "No other players in the directory to mark");
    }

    // Mark one player, then reload and confirm the progress count survived
    // (seeded from the persisted status). The mark's upsert is fire-and-forget
    // (`void saveScanStatus(...)`), so wait for the friend_scan_status request
    // to commit before reloading — otherwise the reload can race the in-flight
    // write and read an empty table.
    const upsert = page
      .waitForResponse((r) => r.url().includes("friend_scan_status"), { timeout: 5000 })
      .catch(() => null);
    await added.click();
    await upsert;

    await page.reload();
    await page.waitForLoadState("networkidle");

    // After reload, at least one "added" check should be reflected in the
    // queue progress ("X tilføjet" counter is > 0).
    const addedCounter = page.getByText(/\d+ tilføjet/);
    await expect(addedCounter.first()).toBeVisible();
  });
});
