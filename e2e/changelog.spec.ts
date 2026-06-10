import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile already created.
const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Changelog (Nyheder)", () => {
  test.skip(!EMAIL || !PASSWORD, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/E-mail/i).fill(EMAIL!);
    await page.getByLabel(/Adgangskode/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /^Log ind$/ }).click();
    await page.waitForURL(/\/players$/);
  });

  test("opens the changelog from the hamburger menu and closes it again", async ({ page }) => {
    // Hamburger at the left edge of the /players header.
    await page.getByRole("button", { name: "Menu" }).click();

    // Dropdown shows the single "Nyheder" item.
    await page.getByRole("button", { name: "Nyheder" }).click();

    // Sheet: heading + at least one entry item.
    await expect(page.getByRole("heading", { name: "Nyheder" })).toBeVisible();
    const entries = page.locator("li");
    await expect(entries.first()).toBeVisible();
    expect(await entries.count()).toBeGreaterThanOrEqual(1);

    // Close via the X button ("Luk").
    await page.getByRole("button", { name: "Luk" }).click();
    await expect(page.getByRole("heading", { name: "Nyheder" })).not.toBeVisible();
  });
});
