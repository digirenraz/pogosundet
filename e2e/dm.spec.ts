import { test, expect } from "@playwright/test";

// Single-user happy-path for direct messages. Requires an existing test account
// with at least one other profile in the directory so the MembersSheet has a
// tappable target. Cross-user assertions (delivery to the partner) are NOT
// covered here — Realtime is unreliable in `npm run dev` per CLAUDE.md 2026-05-19;
// verify cross-user on the Vercel preview.
const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Direct messages", () => {
  test.skip(!EMAIL || !PASSWORD, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/E-mail/i).fill(EMAIL!);
    await page.getByLabel(/Adgangskode/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /^Log ind$/ }).click();
    await page.waitForURL(/\/players$/);
  });

  test("/chat shows the DM section (empty or populated)", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.getByText(/Direkte beskeder/)).toBeVisible();
  });

  test("open a DM from #generelt Members sheet → send → react → reply", async ({ page }) => {
    // Open a channel so the Members header button is available — the same
    // sheet logic powers /chat too, but a channel screen is the closest
    // analogue to a real "I want to DM someone in this channel" flow.
    await page.goto("/chat/generelt");
    await expect(page.getByText(/Velkommen til #generelt/)).toBeVisible();

    // Open the Members sheet. The header member-avatar stack is the trigger.
    await page.getByRole("button", { name: /Medlemmer/i }).first().click();
    await expect(page.getByText(/Online — /)).toBeVisible();

    // Tap the first non-self member row. Self is rendered as a non-button div.
    const firstMember = page.getByRole("button").filter({ hasText: /Online$|Offline$/ }).first();
    await firstMember.click();
    await expect(page).toHaveURL(/\/chat\/dm\/[0-9a-f-]+/);

    // Send a message.
    const body = `e2e-dm ${Date.now()}`;
    await page.getByRole("textbox").fill(body);
    await page.getByRole("button", { name: /^Send$/ }).click();
    const bubble = page.getByRole("button", { name: body });
    await expect(bubble).toBeVisible();

    // Wait for the optimistic placeholder to be replaced by a real DB id —
    // action sheet refuses to open for `opt-*` ids. The realtime echo is the
    // signal; reload to short-circuit if the cross-user echo is delayed locally.
    await page.waitForTimeout(800);
    await page.reload();
    const reloadedBubble = page.getByRole("button", { name: body });
    await expect(reloadedBubble).toBeVisible();
    await reloadedBubble.click();

    // React 👍 from the action sheet.
    await expect(page.getByRole("button", { name: "Svar" })).toBeVisible();
    await page.getByRole("button", { name: "👍" }).first().click();
    await expect(page.getByRole("button", { name: /👍\s*1/ })).toBeVisible();

    // Reply to the same message.
    await page.getByRole("button", { name: body }).click();
    await page.getByRole("button", { name: "Svar" }).click();
    await expect(page.getByText(/Svarer/)).toBeVisible();
    const reply = `e2e-dm-reply ${Date.now()}`;
    await page.getByRole("textbox", { name: /Skriv et svar/ }).fill(reply);
    await page.getByRole("button", { name: /^Send$/ }).click();
    await expect(page.getByRole("button", { name: reply })).toBeVisible();

    // Back to /chat — the conversation should appear in the DM list with the
    // reply as the most recent preview.
    await page.getByRole("button", { name: /^Tilbage$/ }).click();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByText(/Direkte beskeder/)).toBeVisible();
    await expect(page.getByText(new RegExp(`Du:.*${reply.split(" ")[0]}`))).toBeVisible();
  });
});
