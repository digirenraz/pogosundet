import { test, expect } from "@playwright/test";

// Reporting flow for the moderation feature.
//
// Covers what a single test account can actually exercise: opening the report
// sheet on someone else's message, that the action is absent on your own
// messages, and that /admin is not reachable by a non-moderator.
//
// NOT covered here (needs a second account and a moderator flag, so it is a
// prod/preview check per CLAUDE.md's "verify on prod" rule):
//   - the moderator queue rendering a real report
//   - delete / ban / warn / dismiss actually taking effect
//   - the notify-report push
const EMAIL = process.env.E2E_TEST_EMAIL;

test.describe("Moderation — reporting", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  test("own messages offer no report action", async ({ page }) => {
    await page.goto("/chat/generelt");
    await page.waitForLoadState("networkidle");

    // Post a message so there is guaranteed to be one authored by this account.
    const body = `e2e-mod ${Date.now()}`;
    await page.getByRole("textbox").fill(body);
    await page.getByRole("button", { name: /^Send$/, exact: false }).first().click();

    const bubble = page.getByRole("button", { name: body });
    await expect(bubble).toBeVisible();

    // Let the realtime echo replace the optimistic row (which carries an
    // `opt-` id and is deliberately not tappable), then open the action sheet.
    await page.waitForTimeout(800);
    await page.reload();
    await page.waitForLoadState("networkidle");

    const settled = page.getByRole("button", { name: body }).first();
    await expect(settled).toBeVisible();
    await settled.press("Enter");

    // Reply/copy are offered on your own message; "Anmeld" is not.
    await expect(page.getByRole("button", { name: "Svar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Anmeld" })).toHaveCount(0);
  });

  test("another user's message opens the report sheet", async ({ page }) => {
    await page.goto("/chat/generelt");
    await page.waitForLoadState("networkidle");

    // Find a message bubble that is NOT one of ours. Other authors render an
    // avatar + name header above their group, so scope to those groups.
    const otherBubbles = page
      .locator("main")
      .getByRole("button")
      .filter({ hasNotText: /^$/ });

    const count = await otherBubbles.count();
    if (count === 0) {
      test.skip(true, "No messages in #generelt yet");
      return;
    }

    // Walk bubbles until one exposes "Anmeld" — i.e. it isn't ours.
    let opened = false;
    for (let i = 0; i < Math.min(count, 12); i++) {
      await otherBubbles.nth(i).press("Enter");
      const report = page.getByRole("button", { name: "Anmeld" });
      if ((await report.count()) > 0) {
        await report.click();
        opened = true;
        break;
      }
      // Not someone else's message — close the sheet and try the next bubble.
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Luk" }).first().click({ trial: true }).catch(() => {});
    }

    if (!opened) {
      test.skip(true, "No other user's message available to report");
      return;
    }

    // The report sheet: reason radios + optional note + submit.
    await expect(
      page.getByRole("heading", { name: "Anmeld besked" })
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: /Chikane eller mobning/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send anmeldelse" })
    ).toBeVisible();
  });

  test("/admin is not reachable for a non-moderator", async ({ page }) => {
    const response = await page.goto("/admin");
    // notFound() renders the 404 page — deliberately not a redirect, so the
    // route's existence isn't confirmed to ordinary users.
    expect(response?.status()).toBe(404);
  });
});
