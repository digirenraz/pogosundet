import { test, expect } from "@playwright/test";

// Regression test for the account-deletion FK-cascade bug fixed in migration
// 025. Signs up a throwaway account, gives it real activity (a channel
// message — the exact row shape whose missing ON DELETE CASCADE broke
// deletion), then deletes it. Before the fix this failed with a foreign key
// violation surfaced as a generic error; after it, deletion succeeds.
//
// This performs a REAL signup and REAL deletion against whatever Supabase
// project e2e runs against — only run this against pogosundet-preview
// (confirm-email disabled there, so signup logs straight in), never prod.
const EMAIL_CREDS = process.env.E2E_TEST_EMAIL;

test.describe("Account deletion — real cascade", () => {
  test.skip(!EMAIL_CREDS, "E2E_TEST_EMAIL not configured — no real Supabase project to test against");

  test("deleting an account with a channel message succeeds", async ({ page }) => {
    const unique = Date.now();
    const email = `e2e-delete-${unique}@example.com`;
    const password = "TestPass123!";
    const messageBody = `e2e delete test ${unique}`;

    // 1. Sign up a fresh throwaway account.
    await page.goto("/register");

    // This context has no storageState (unlike the persistent E2E_TEST_EMAIL
    // account other specs reuse), so the Amplitude consent banner appears
    // fresh and — being a fixed overlay — blocks every click below until
    // dismissed. Mirrors global-setup.ts's dismissal.
    const consentBanner = page.getByRole("dialog", { name: /Samtykke til analyse/ });
    try {
      await consentBanner.waitFor({ state: "visible", timeout: 5000 });
      await page.getByRole("button", { name: /Afvis/ }).click();
      await consentBanner.waitFor({ state: "hidden", timeout: 5000 });
    } catch {
      // No banner shown — nothing to dismiss.
    }

    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Adgangskode").fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Opret konto" }).click();

    // A brand-new user has no profile yet, so the profile guard sends them here.
    await page.waitForURL(/\/profile\/setup/, { timeout: 15000 });

    // 2. Complete profile setup — creates the profiles row.
    await page.getByLabel("In-game trænernavn").fill(`E2EDelete${unique}`);
    await page.getByLabel("Pokémon GO vennekode").fill("1234 5678 9012");
    await page.getByRole("button", { name: "Gem profil og fortsæt" }).click();
    await page.waitForURL(/\/players/, { timeout: 15000 });

    // 3. Post a channel message — channel_messages.user_id -> profiles.user_id
    // is one of the FKs migration 025 fixes.
    await page.goto("/chat/generelt");
    await page
      .getByRole("textbox", { name: /Besked til #generelt/ })
      .fill(messageBody);
    await page.getByRole("button", { name: /^Send$/ }).click();
    await expect(page.getByText(messageBody)).toBeVisible();

    // 4. Delete the account.
    await page.goto("/profile/edit");
    await page.getByRole("button", { name: "Slet konto permanent" }).click();
    await page.getByRole("button", { name: "Ja, slet min konto" }).click();

    // Before migration 025 this failed silently into deleteErrorGeneric
    // ("Noget gik galt...") because the FK violation surfaced as a generic
    // 500. Success signs out and redirects to /.
    await page.waitForURL("/", { timeout: 15000 });
    await expect(page.getByText("Noget gik galt")).not.toBeVisible();
  });
});
