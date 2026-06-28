import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile already created and at
// least one active raid in the database (the seeded raid the rest of the
// suite assumes). Slice 16: reactions + replies on raid chat.
//
// Single-user only — cross-user realtime is unreliable locally per CLAUDE.md
// (decision 2026-05-19). Push to a Vercel preview to validate cross-user.
const EMAIL = process.env.E2E_TEST_EMAIL;

test.describe("Raid chat — reactions + replies", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  // Helper: open the first raid card on /raids. Skips the test if none exist.
  async function openFirstRaid(page: import("@playwright/test").Page) {
    await page.goto("/raids");
    const firstRaid = page.locator('a[href^="/raids/"]').first();
    if ((await firstRaid.count()) === 0) {
      test.skip(true, "No active raids in DB — seed one before running");
    }
    await firstRaid.click();
    await page.waitForURL(/\/raids\/[\w-]+$/);
    await expect(page.getByText(/Chat/i).first()).toBeVisible();
  }

  test("tap a message → react 👍 → chip appears below the bubble", async ({ page }) => {
    await openFirstRaid(page);

    const body = `e2e-raid-react ${Date.now()}`;
    await page.getByRole("textbox").last().fill(body);
    await page.getByRole("button", { name: /^Send$/ }).click();

    const bubble = page.getByRole("button", { name: body });
    await expect(bubble).toBeVisible();
    await bubble.click();

    // Action sheet visible — pick 👍 from the quick-reaction row.
    await expect(page.getByRole("button", { name: "Svar" })).toBeVisible();
    await page.getByRole("button", { name: "👍" }).first().click();

    // Sheet closes; chip with the emoji and count 1 appears.
    await expect(page.getByRole("button", { name: "Svar" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /👍\s*1/ })).toBeVisible();

    // Tap the chip again → it should disappear (toggle to remove).
    await page.getByRole("button", { name: /👍\s*1/ }).click();
    await expect(page.getByRole("button", { name: /👍\s*1/ })).toHaveCount(0);
  });

  test("tap a message → Svar → composer banner → send reply → quoted preview", async ({ page }) => {
    await openFirstRaid(page);

    // Seed an original message to reply to.
    const original = `e2e-raid-original ${Date.now()}`;
    await page.getByRole("textbox").last().fill(original);
    await page.getByRole("button", { name: /^Send$/ }).click();
    const originalBubble = page.getByRole("button", { name: original });
    await expect(originalBubble).toBeVisible();

    // Open sheet, tap Svar — banner appears.
    await originalBubble.click();
    await page.getByRole("button", { name: "Svar" }).click();
    await expect(page.getByText(/Svarer/)).toBeVisible();

    // Send reply via the reply-mode textbox.
    const reply = `e2e-raid-reply ${Date.now()}`;
    await page.getByRole("textbox", { name: /Skriv et svar/ }).fill(reply);
    await page.getByRole("button", { name: /^Send$/ }).click();

    // Reply bubble is visible and a quoted preview of the original is rendered.
    await expect(page.getByRole("button", { name: reply })).toBeVisible();
    // The quote rendering preserves the original body text in a separate node
    // (not inside a button), so two occurrences total: the original bubble +
    // the quote above the reply.
    await expect(page.getByText(original)).toHaveCount(2);
  });
});
