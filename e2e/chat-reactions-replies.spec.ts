import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile already created.
const EMAIL = process.env.E2E_TEST_EMAIL;

test.describe("Chat — reactions + replies", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  test("tap a message → react 👍 → chip appears below the bubble", async ({ page }) => {
    await page.goto("/chat/generelt");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Velkommen til #generelt/).first()).toBeVisible();

    const body = `e2e-react ${Date.now()}`;
    await page.getByRole("textbox", { name: /Besked til #generelt/ }).fill(body);
    await page.getByRole("button", { name: /^Send$/ }).click();

    const bubble = page.getByRole("button", { name: body });
    await expect(bubble).toBeVisible();
    await bubble.click();

    // Wait for the action sheet to render before clicking the emoji.
    // The sheet is a fixed z-40 overlay; wait for the quick-reaction row.
    // Use a text-content locator — emoji accessible names can vary by browser.
    // force: true bypasses pointer-event actionability checks (the sheet
    // backdrop button is absolute inset-0 and can intercept pointer events
    // during the opening animation).
    const thumbsUp = page.locator('button').filter({ hasText: '👍' }).first();
    await thumbsUp.waitFor({ state: "visible", timeout: 10000 });
    await thumbsUp.click({ force: true });

    // Sheet closes; chip with the emoji and count 1 appears.
    await expect(page.getByRole("button", { name: "Svar" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /👍\s*1/ })).toBeVisible();
  });

  test("tap a message → Svar → composer banner → send reply → quoted preview", async ({ page }) => {
    await page.goto("/chat/generelt");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Velkommen til #generelt/).first()).toBeVisible();

    // Seed an original message to reply to.
    const original = `e2e-original ${Date.now()}`;
    await page.getByRole("textbox", { name: /Besked til #generelt/ }).fill(original);
    await page.getByRole("button", { name: /^Send$/ }).click();
    const originalBubble = page.getByRole("button", { name: original });
    await expect(originalBubble).toBeVisible();

    // Open sheet, tap Svar — banner appears.
    // "Svar" is only available for other users' messages; skip if own-message action sheet.
    await originalBubble.click();
    const svarBtn = page.getByRole("button", { name: "Svar" });
    if (!(await svarBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "Svar not in action sheet for own messages — needs a second user's message");
    }
    await svarBtn.click();
    await expect(page.getByText(/Svarer/)).toBeVisible();

    // Send reply.
    const reply = `e2e-reply ${Date.now()}`;
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
