import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile already created.
const EMAIL = process.env.E2E_TEST_EMAIL;

test.describe("Kom i gang (getting-started guide)", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  test("desktop: sidebar item opens the guide", { tag: "@desktop" }, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/players");
    await page.waitForLoadState("networkidle");
    // Loading screen stays in DOM until its CSS animation finishes — networkidle
    // doesn't wait for that and its fixed overlay intercepts clicks on the sidebar.
    await page.locator('[aria-label="Indlæser"]').waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});

    // "Kom i gang" lives in the desktop sidebar (lg+). Select by href attribute —
    // more robust than a role+name query. The item is in the bottom group of the
    // sidebar and may be below the visible viewport area; use evaluate to scroll
    // it into view and click without relying on Playwright visibility checks.
    const komIGangLink = page.locator('a[href="/onboarding"]').first();
    await komIGangLink.waitFor({ state: "attached", timeout: 10000 });
    await komIGangLink.evaluate((el) => {
      el.scrollIntoView({ block: "center" });
      (el as HTMLElement).click();
    });
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
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("link", { name: "Kom i gang" }).click();
    await page.waitForURL(/\/onboarding$/);

    await expect(
      page.getByRole("heading", { name: "Velkommen til PoGoSundet" })
    ).toBeVisible();
  });
});
