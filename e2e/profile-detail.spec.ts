import { test, expect } from "@playwright/test";

// Requires an existing test account; configure via E2E_TEST_EMAIL.
// CI doesn't have these by default — the test skips when they're missing.
const EMAIL = process.env.E2E_TEST_EMAIL;

test.describe("Player detail deck", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/players");
    await page.waitForLoadState("networkidle");
  });

  test("opens a player, copies the friend code, swipes, and returns", async ({ page }) => {
    // Grant clipboard-write permission so navigator.clipboard.writeText() succeeds
    // in the headless browser and the button can transition to "Kopieret!".
    await page.context().grantPermissions(["clipboard-write"]);

    // Open the first player card
    const firstCard = page.locator('a[href^="/players/"]').first();
    await expect(firstCard).toBeVisible();
    const friendCode = await firstCard.locator(".tabular-nums").first().innerText();
    await firstCard.click();

    // Wait for the player detail page to settle (client-side navigation; the
    // deck needs a ResizeObserver tick to set card widths before the layout
    // is fully interactive).
    await page.waitForLoadState("networkidle");

    // QR section + friend code visible
    await expect(page.getByText(/Vennekode/i)).toBeVisible();
    await expect(page.getByText(friendCode).last()).toBeVisible();
    await expect(page.locator("svg").first()).toBeVisible();

    // Copy the code — the button is inside an overflow-y:auto card within an
    // overflow-hidden h-screen deck. Playwright's click() can't scroll into it
    // (the outer container is overflow:hidden so window scroll doesn't reach it).
    // Use evaluate to scroll the inner container and then invoke click() directly.
    // first() because the deck keeps all cards in DOM simultaneously.
    const copyBtn = page.getByRole("button", { name: /Kopier kode/ }).first();
    await copyBtn.evaluate((el) => {
      el.scrollIntoView({ block: "center" });
      (el as HTMLElement).click();
    });
    await expect(page.getByRole("button", { name: /Kopieret!/ })).toBeVisible();

    // Pagination starts at "1 / N"
    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();

    // Click the right chevron — page index moves forward
    await page.getByRole("button", { name: /Næste/ }).click();
    await expect(page.getByText(/^2 \/ \d+$/)).toBeVisible();

    // Back arrow returns to /players
    await page.getByRole("button", { name: /Tilbage/ }).click();
    await page.waitForURL(/\/players$/);
    await expect(page.getByRole("heading", { name: /Lokale Trænere/i }).or(page.getByText(/Lokale Trænere/))).toBeVisible();
  });
});
