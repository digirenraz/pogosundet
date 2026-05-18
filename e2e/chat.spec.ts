import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile already created.
const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Chat — channels", () => {
  test.skip(!EMAIL || !PASSWORD, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/E-mail/i).fill(EMAIL!);
    await page.getByLabel(/Adgangskode/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /^Log ind$/ }).click();
    await page.waitForURL(/\/players$/);
  });

  test("channel list shows #generelt + #app-feedback, no DM section", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.getByRole("heading", { name: /^Chat$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /generelt/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /app-feedback/ })).toBeVisible();
    await expect(page.getByText(/Direkte beskeder/i)).toHaveCount(0);
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
