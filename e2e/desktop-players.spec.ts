import { test, expect } from "@playwright/test";

// Desktop player overview — the QR "Scan-session" shown at lg+ (≥1024px) on /players.
// Requires an existing test account; configure via E2E_TEST_EMAIL / E2E_TEST_PASSWORD.
// CI doesn't have these by default — the test skips when they're missing.
const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Desktop player overview (scan-session)", () => {
  test.skip(!EMAIL || !PASSWORD, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/E-mail/i).fill(EMAIL!);
    await page.getByLabel(/Adgangskode/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /^Log ind$/ }).click();
    await page.waitForURL(/\/players$/);
  });

  test("shows the sidebar + scan-session and advances the queue", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Desktop sidebar brand + the scan-session heading render.
    await expect(page.getByText("PoGoSundet")).toBeVisible();
    await expect(page.getByText("Scan-session")).toBeVisible();

    // The big QR is on screen (FriendCodeQR renders an SVG).
    await expect(page.locator("svg").first()).toBeVisible();

    // Progress starts at "1 / N".
    const progress = page.getByText(/^1 \/ \d+$/);
    await expect(progress).toBeVisible();
    const total = Number((await progress.innerText()).split("/")[1].trim());

    // With more than one other player, "Tilføjet → næste" advances the queue.
    if (total >= 2) {
      await page.getByRole("button", { name: /Tilføjet → næste/ }).click();
      await expect(page.getByText(/^2 \/ \d+$/)).toBeVisible();
      // One trainer is now marked added in the progress label.
      await expect(page.getByText(/^1 tilføjet$/)).toBeVisible();
    }
  });

  test("mobile layout is unaffected — bottom nav, no desktop sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });

    // The mobile directory header + bottom nav are present.
    await expect(page.getByText("Lokale Trænere")).toBeVisible();
    // The desktop-only scan-session heading is hidden at mobile width.
    await expect(page.getByText("Scan-session")).toBeHidden();
  });
});
