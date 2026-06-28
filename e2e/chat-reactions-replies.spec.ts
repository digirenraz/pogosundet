import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile already created.
const EMAIL = process.env.E2E_TEST_EMAIL;

test.describe("Chat — reactions + replies", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  test("tap a message → react 👍 → chip appears below the bubble", async ({ page }) => {
    await page.goto("/chat/generelt");
    await expect(page.getByText(/Velkommen til #generelt/)).toBeVisible();

    const body = `e2e-react ${Date.now()}`;
    await page.getByRole("textbox", { name: /Besked til #generelt/ }).fill(body);
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
  });

  test("tap a message → Svar → composer banner → send reply → quoted preview", async ({ page }) => {
    await page.goto("/chat/generelt");
    await expect(page.getByText(/Velkommen til #generelt/)).toBeVisible();

    // Seed an original message to reply to.
    const original = `e2e-original ${Date.now()}`;
    await page.getByRole("textbox", { name: /Besked til #generelt/ }).fill(original);
    await page.getByRole("button", { name: /^Send$/ }).click();
    const originalBubble = page.getByRole("button", { name: original });
    await expect(originalBubble).toBeVisible();

    // Open sheet, tap Svar — banner appears.
    await originalBubble.click();
    await page.getByRole("button", { name: "Svar" }).click();
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
