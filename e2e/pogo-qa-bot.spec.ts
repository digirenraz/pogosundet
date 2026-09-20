import { test, expect } from "@playwright/test";

// Q&A bot (!pogo) — the consent explainer and the unconfigured-route path.
//
// Deliberately makes NO real LLM call. CI has no ANTHROPIC_API_KEY, so
// /api/bot/ask answers 503 and the composer shows the "not switched on" notice
// — that is the path asserted here. There is no test-mode backdoor in the
// route: a production endpoint that writes into chat must not grow one.
//
// What this cannot cover locally: a real answer arriving over Realtime. Verify
// that on the Vercel preview with the key set (see docs/plans/pogo-qa-bot.md).
const EMAIL = process.env.E2E_TEST_EMAIL;

// Mirrors BOT_CONSENT_KEY in src/components/chat/ChannelScreen.tsx.
const CONSENT_KEY = "pogosundet:bot-consent";

test.describe("Q&A bot — !pogo", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  // Each test starts from "this device has never asked the bot anything".
  test.beforeEach(async ({ page }) => {
    await page.goto("/chat/generelt");
    await page.evaluate((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* storage disabled — the app treats that as "not consented" anyway */
      }
    }, CONSENT_KEY);
  });

  test("the first !pogo shows the explainer instead of sending", async ({ page }) => {
    await page.goto("/chat/generelt");
    await page.waitForLoadState("networkidle");

    const body = `!pogo e2e ${Date.now()}`;
    await page.getByRole("textbox", { name: /Besked til #generelt/ }).fill(body);
    await page.getByRole("button", { name: /^Send$/, exact: true }).click();

    // Explainer is up…
    await expect(page.getByRole("heading", { name: /Spørg botten/ })).toBeVisible();
    // …and it says the two things it must say.
    await expect(page.getByText(/Anthropic/)).toBeVisible();
    await expect(
      page.getByText(/Skriv ikke personlige oplysninger/)
    ).toBeVisible();

    // The question is held, not posted — no bubble for it yet.
    await expect(page.getByText(body, { exact: true })).toHaveCount(0);
  });

  test("cancelling the explainer discards the question", async ({ page }) => {
    await page.goto("/chat/generelt");
    await page.waitForLoadState("networkidle");

    const body = `!pogo e2e-cancel ${Date.now()}`;
    await page.getByRole("textbox", { name: /Besked til #generelt/ }).fill(body);
    await page.getByRole("button", { name: /^Send$/, exact: true }).click();
    await expect(page.getByRole("heading", { name: /Spørg botten/ })).toBeVisible();

    await page.getByRole("button", { name: /^Annullér$/ }).click();
    await expect(page.getByRole("heading", { name: /Spørg botten/ })).toHaveCount(0);
    await expect(page.getByText(body, { exact: true })).toHaveCount(0);

    // Declining must not be remembered as consent.
    const stored = await page.evaluate((key) => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    }, CONSENT_KEY);
    expect(stored).toBeNull();
  });

  test("accepting sends the held question, and the bot is unavailable in CI", async ({
    page,
  }) => {
    await page.goto("/chat/generelt");
    await page.waitForLoadState("networkidle");

    const body = `!pogo e2e-accept ${Date.now()}`;
    await page.getByRole("textbox", { name: /Besked til #generelt/ }).fill(body);
    await page.getByRole("button", { name: /^Send$/, exact: true }).click();
    await expect(page.getByRole("heading", { name: /Spørg botten/ })).toBeVisible();

    // The route is called only after the question is actually posted.
    const askCall = page.waitForResponse(
      (r) => r.url().includes("/api/bot/ask") && r.request().method() === "POST"
    );
    await page.getByRole("button", { name: /Forstået/ }).click();

    // The held question posts verbatim.
    await expect(page.getByText(body, { exact: true }).first()).toBeVisible();

    // No API key in CI → 503 → the "not switched on" notice, not a hang.
    const res = await askCall;
    expect(res.status()).toBe(503);
    await expect(page.getByText(/Botten er ikke slået til/)).toBeVisible();
  });

  test("the explainer does not reappear once accepted", async ({ page }) => {
    // Pre-seed consent, as an earlier question on this device would have.
    await page.goto("/chat/generelt");
    await page.evaluate((key) => window.localStorage.setItem(key, "1"), CONSENT_KEY);
    await page.reload();
    await page.waitForLoadState("networkidle");

    const body = `!pogo e2e-second ${Date.now()}`;
    await page.getByRole("textbox", { name: /Besked til #generelt/ }).fill(body);
    await page.getByRole("button", { name: /^Send$/, exact: true }).click();

    // Straight through to sending — no sheet.
    await expect(page.getByRole("heading", { name: /Spørg botten/ })).toHaveCount(0);
    await expect(page.getByText(body, { exact: true }).first()).toBeVisible();
  });

  test("an ordinary message never triggers the bot", async ({ page }) => {
    await page.goto("/chat/generelt");
    await page.waitForLoadState("networkidle");

    let askCalled = false;
    page.on("request", (r) => {
      if (r.url().includes("/api/bot/ask")) askCalled = true;
    });

    // Note the "pogo" substring without the leading "!" — the trigger is the
    // prefix, not the word, and this must stay an ordinary message.
    const body = `helt almindelig pogo-besked ${Date.now()}`;
    await page.getByRole("textbox", { name: /Besked til #generelt/ }).fill(body);
    await page.getByRole("button", { name: /^Send$/, exact: true }).click();

    await expect(page.getByText(body, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Spørg botten/ })).toHaveCount(0);
    expect(askCalled).toBe(false);
  });

  test("#app-feedback is outside QA_CHANNELS, so !pogo is just text there", async ({
    page,
  }) => {
    await page.goto("/chat/feedback");
    await page.waitForLoadState("networkidle");

    let askCalled = false;
    page.on("request", (r) => {
      if (r.url().includes("/api/bot/ask")) askCalled = true;
    });

    const body = `!pogo e2e-feedback ${Date.now()}`;
    await page.getByRole("textbox", { name: /Besked til #app-feedback/ }).fill(body);
    await page.getByRole("button", { name: /^Send$/, exact: true }).click();

    await expect(page.getByText(body, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Spørg botten/ })).toHaveCount(0);
    expect(askCalled).toBe(false);
  });
});
