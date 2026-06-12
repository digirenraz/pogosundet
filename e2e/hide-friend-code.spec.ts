import { test, expect } from "@playwright/test";

// Issue #101: "hide my friend code" toggle on the edit-profile page.
// Requires an existing test account with a profile already created.
const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Hide friend code", () => {
  test.skip(!EMAIL || !PASSWORD, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/E-mail/i).fill(EMAIL!);
    await page.getByLabel(/Adgangskode/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /^Log ind$/ }).click();
    await page.waitForURL(/\/players$/);
  });

  // The toggle round-trips through the form. We flip it on, save, reopen, and
  // assert it persisted — then restore it to off so the shared test account is
  // left in its default state for other specs / the live app.
  test("toggles hide-friend-code on and off and persists across reloads", async ({ page }) => {
    const toggle = () => page.getByRole("switch", { name: /Skjul min vennekode/i });

    await page.goto("/profile/edit");
    await expect(toggle()).toBeVisible();
    const initiallyChecked = (await toggle().getAttribute("aria-checked")) === "true";

    // Turn it ON, save, reopen → persisted as checked.
    if (!initiallyChecked) await toggle().click();
    await expect(toggle()).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: /Gem ændringer/ }).click();
    await page.waitForURL(/\/profile$/);

    await page.goto("/profile/edit");
    await expect(toggle()).toHaveAttribute("aria-checked", "true");

    // Restore to OFF, save, reopen → persisted as unchecked.
    await toggle().click();
    await expect(toggle()).toHaveAttribute("aria-checked", "false");
    await page.getByRole("button", { name: /Gem ændringer/ }).click();
    await page.waitForURL(/\/profile$/);

    await page.goto("/profile/edit");
    await expect(toggle()).toHaveAttribute("aria-checked", "false");
  });
});
