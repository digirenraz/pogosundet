import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile already created.
const EMAIL = process.env.E2E_TEST_EMAIL;

test.describe("Chat — channels", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  test("channel list shows #generelt + #app-feedback + Direct messages section", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.getByRole("heading", { name: /^Chat$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /generelt/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /app-feedback/ })).toBeVisible();
    await expect(page.getByText(/Direkte beskeder/i)).toBeVisible();
  });

  test("send a message in #generelt — it appears in the stream", async ({ page }) => {
    await page.goto("/chat/generelt");
    await expect(page.getByText(/Velkommen til #generelt/)).toBeVisible();

    const body = `e2e ${Date.now()}`;
    await page.getByRole("textbox", { name: /Besked til #generelt/ }).fill(body);
    await page.getByRole("button", { name: /^Send$/ }).click();

    await expect(page.getByText(body)).toBeVisible();
    await expect(page.getByText(/Sendt ·/)).toBeVisible();
  });

  test("invalid channel id returns 404", async ({ page }) => {
    const res = await page.goto("/chat/nonsense");
    expect(res?.status()).toBe(404);
  });
});
