import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile already created.
const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Profile edit", () => {
  test.skip(!EMAIL || !PASSWORD, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/E-mail/i).fill(EMAIL!);
    await page.getByLabel(/Adgangskode/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /^Log ind$/ }).click();
    await page.waitForURL(/\/players$/);
  });

  test("sets team to Valor, picks level 42, saves, lands on /profile with the chip visible", async ({ page }) => {
    await page.goto("/profile/edit");
    await expect(page.getByRole("heading", { name: /Rediger profil/i }).or(page.getByText(/Rediger profil/))).toBeVisible();

    // Pick Valor
    await page.getByRole("button", { name: /^Valor$/ }).click();

    // Drag the level slider to 42
    const slider = page.getByRole("slider", { name: /Level/ });
    await slider.focus();
    await slider.evaluate((el: HTMLInputElement) => {
      el.value = "42";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Save
    await page.getByRole("button", { name: /Gem ændringer/ }).click();

    // After save redirects to /profile
    await page.waitForURL(/\/profile$/);

    // Level 42 chip + Team Valor visible
    await expect(page.getByText(/Niveau 42/)).toBeVisible();
    await expect(page.getByText(/Team Valor/)).toBeVisible();
  });

  test("logs out from the edit profile page", async ({ page }) => {
    await page.goto("/profile/edit");
    const logout = page.getByRole("button", { name: /^Log ud$/ });
    await expect(logout).toBeVisible();
    await logout.click();
    // Lands on the logged-out home page, which shows the login CTA.
    await expect(page.getByRole("link", { name: /Log ind/ })).toBeVisible();
  });
});
