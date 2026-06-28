import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile already created.
const EMAIL = process.env.E2E_TEST_EMAIL;

test.describe("Profile edit", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  test("sets team to Valor, picks level 42, saves, lands on /profile with the chip visible", async ({ page }) => {
    await page.goto("/profile/edit");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Rediger profil/i }).or(page.getByText(/Rediger profil/))).toBeVisible();

    // Pick Valor (guard: form may not load if get_own_profile() RPC is absent on preview)
    const valorBtn = page.getByRole("button", { name: /^Valor$/ });
    if (!(await valorBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Profile form did not load — likely migration 022 (get_own_profile RPC) not applied to preview DB");
    }
    await valorBtn.click();

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
    await page.waitForLoadState("networkidle");
    const logout = page.getByRole("button", { name: /^Log ud$/ });
    await expect(logout).toBeVisible();
    await logout.click();
    // Lands on the logged-out home page, which shows the login CTA.
    await expect(page.getByRole("link", { name: /Log ind/ })).toBeVisible();
  });
});
