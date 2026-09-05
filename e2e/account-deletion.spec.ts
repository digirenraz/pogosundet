import { test, expect } from "@playwright/test";

// Regression test for the account-deletion FK-cascade bug fixed in migration
// 025. Signs up a throwaway account, gives it real activity (a channel
// message and a live location share — the exact row shape whose missing
// ON DELETE CASCADE broke deletion), then deletes it. Before the fix this failed with a foreign key
// violation surfaced as a generic error; after it, deletion succeeds.
//
// This performs a REAL signup and REAL deletion against whatever Supabase
// project e2e runs against — only run this against pogosundet-preview
// (confirm-email disabled there, so signup logs straight in), never prod.
const EMAIL_CREDS = process.env.E2E_TEST_EMAIL;

test.describe("Account deletion — real cascade", () => {
  test.skip(!EMAIL_CREDS, "E2E_TEST_EMAIL not configured — no real Supabase project to test against");
  // Geolocation is granted so the account can also start a live location share
  // before deleting — live_locations carries the same profiles(user_id) FK
  // shape that broke deletion before migration 025.
  test.use({ permissions: ["geolocation"], geolocation: { latitude: 55.8331, longitude: 12.0431 } });

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
    try {
      await page.waitForURL(/\/players/, { timeout: 8000 });
    } catch {
      // Pre-existing, separate quirk (not this fix's concern): the profile
      // insert succeeds, but AuthRedirectOnSignIn's earlier router.replace
      // to /players (before the profile existed, redirected back here by
      // the profile guard) can leave a stale entry in Next's client router
      // cache, so this handler's router.push("/players") — unlike the
      // delete-account handler, which follows its push with a
      // router.refresh() — replays the cached redirect instead of
      // refetching. Force a hard navigation past it.
      await page.goto("/players");
    }

    // 3. Post a channel message — channel_messages.user_id -> profiles.user_id
    // is one of the FKs migration 025 fixes.
    await page.goto("/chat/generelt");
    await page
      .getByRole("textbox", { name: /Besked til #generelt/ })
      .fill(messageBody);
    await page.getByRole("button", { name: /^Send$/ }).click();
    await expect(page.getByText(messageBody)).toBeVisible();

    // 4. Start a live location share — live_locations.user_id carries the same
    // profiles(user_id) FK that broke deletion before migration 025, so this
    // proves 026's cascade empirically rather than by reading the DDL.
    await page.route("**://*.tile.openstreetmap.org/**", (route) => route.abort());
    await page.route("**://tile.openstreetmap.org/**", (route) => route.abort());
    await page.goto("/kort");
    await page.getByRole("button", { name: "Del min position" }).click();
    const consent = page.getByRole("button", { name: "Jeg forstår" });
    if (await consent.isVisible().catch(() => false)) {
      await consent.click();
    }
    await page.getByRole("button", { name: "15 min" }).click();
    await page.getByRole("button", { name: "Start deling" }).click();
    await expect(page.getByText("Du deler din position")).toBeVisible();

    // 5. Delete the account.
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
