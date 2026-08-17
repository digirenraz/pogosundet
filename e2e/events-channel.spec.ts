import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile already created.
const EMAIL = process.env.E2E_TEST_EMAIL;

test.describe("Chat — #events channel", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  test("#events appears in the channel list and opens", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    const link = page.getByRole("link", { name: /events/ }).first();
    await expect(link).toBeVisible();

    await page.goto("/chat/events");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/#events/).first()).toBeVisible();
  });

  test("the channel credits LeekDuck, as ScrapedDuck's terms require", async ({ page }) => {
    await page.goto("/chat/events");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/LeekDuck/).first()).toBeVisible();
  });

  test("a multi-line message keeps its line breaks and links are tappable", async ({ page }) => {
    // The bot posts name / time / link on separate lines. Before the renderer
    // fix those collapsed into one run-on line and the URL was plain text.
    await page.goto("/chat/events");
    await page.waitForLoadState("networkidle");

    const body = `e2e ${Date.now()}\nlinje to\nhttps://leekduck.com/events/`;
    const composer = page.getByRole("textbox", { name: /Besked til #events/ });
    await composer.fill(body);
    await page.getByRole("button", { name: /^Send$/, exact: true }).click();

    const bubble = page.getByText(/linje to/).first();
    await expect(bubble).toBeVisible();

    // pre-wrap is what preserves the newlines the composer sent.
    await expect(bubble).toHaveCSS("white-space", "pre-wrap");

    const link = page.getByRole("link", { name: "https://leekduck.com/events/" }).first();
    await expect(link).toHaveAttribute("href", "https://leekduck.com/events/");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });
});
