import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile already created.
const EMAIL = process.env.E2E_TEST_EMAIL;

test.describe("Kom i gang (getting-started guide)", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  test("desktop: sidebar item opens the guide", { tag: "@desktop" }, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/players");

    // "Kom i gang" lives in the desktop sidebar (lg+).
    await page.getByRole("link", { name: "Kom i gang" }).click();
    await page.waitForURL(/\/onboarding$/);

    await expect(
      page.getByRole("heading", { name: "Velkommen til PoGoSundet" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Installér PoGoSundet på din telefon/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Tilføj venner med QR/ })
    ).toBeVisible();
  });

  test("mobile: hamburger menu opens the guide", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/players");

    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("link", { name: "Kom i gang" }).click();
    await page.waitForURL(/\/onboarding$/);

    await expect(
      page.getByRole("heading", { name: "Velkommen til PoGoSundet" })
    ).toBeVisible();
  });
});
