import { test, expect } from "@playwright/test";

// Issue #114: opening a raid detail page from a push notification left the user
// stuck — the back arrow used router.back(), which is a no-op when the service
// worker opens a fresh window with no in-app history. The fix pushes to /raids.
//
// We reproduce the "no history" condition by navigating DIRECTLY to the raid
// URL (a fresh page load, like the SW's clients.openWindow) instead of clicking
// through from /raids — then assert the back arrow still reaches the list.
//
// Requires a test account with a profile and at least one active raid (same
// seeded-raid assumption as the other raid specs).
const EMAIL = process.env.E2E_TEST_EMAIL;

test.describe("Raid detail — back navigation", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  test("back arrow reaches /raids even with no in-app history (notification-opened)", async ({ page }) => {
    // Discover a real raid id from the list, then drop the history by loading
    // the raid URL fresh — this mimics arriving from a notification.
    await page.goto("/raids");
    const firstRaid = page.locator('a[href^="/raids/"]').first();
    if ((await firstRaid.count()) === 0) {
      test.skip(true, "No active raids in DB — seed one before running");
    }
    const href = await firstRaid.getAttribute("href");
    expect(href).toMatch(/\/raids\/[\w-]+$/);

    await page.goto(href!);
    await page.waitForURL(/\/raids\/[\w-]+$/);

    // Tap the back arrow — must land on the raids list, not stay stuck.
    await page.getByRole("button", { name: /Tilbage/i }).click();
    await page.waitForURL(/\/raids$/);
    await expect(page).toHaveURL(/\/raids$/);
  });
});
