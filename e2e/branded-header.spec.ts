import { test, expect } from "@playwright/test";

// Branded app header — icon + "PoGoSundet" wordmark in the top row, with the
// screen name as a large title below. Mobile-only (desktop is branded by the
// sidebar), so this runs at a phone viewport.
//
// Requires an existing test account; configure via E2E_TEST_EMAIL / E2E_TEST_PASSWORD.
// CI doesn't have these by default — the test skips when they're missing.
const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Branded header", () => {
  test.skip(!EMAIL || !PASSWORD, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured");

  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/E-mail/i).fill(EMAIL!);
    await page.getByLabel(/Adgangskode/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /^Log ind$/ }).click();
    await page.waitForURL(/\/players$/);
  });

  test("shows the wordmark + large title on the tab screens", async ({ page }) => {
    // Players — wordmark in the lockup, screen name as the large title.
    await expect(page.getByText("PoGoSundet")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Lokale Trænere/i })
    ).toBeVisible();

    // Raids — branded header with the "+" create action.
    await page.goto("/raids");
    await expect(page.getByText("PoGoSundet")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Aktive Raids/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Post raid/i })).toBeVisible();

    // Chat — branded header.
    await page.goto("/chat");
    await expect(page.getByText("PoGoSundet")).toBeVisible();

    // Profil — branded header.
    await page.goto("/profile");
    await expect(page.getByText("PoGoSundet")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Min profil/i })).toBeVisible();
  });
});
