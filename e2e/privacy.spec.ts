import { test, expect } from "@playwright/test";

// The privacy policy is public (logged-out users reach it from the register
// consent checkbox). These assertions guard the GDPR data-processor disclosure
// — in particular that Sentry is listed after it was added on 2026-05-29.
test("privacy policy discloses Sentry as a data processor", async ({ page }) => {
  await page.goto("/privacy");

  await expect(
    page.getByRole("heading", { name: "7. Databehandlere" })
  ).toBeVisible();

  // Sentry disclosure + the GDPR-relevant "no IP/PII deliberately collected" claim.
  await expect(page.getByText(/Sentry/)).toBeVisible();
  await expect(
    page.getByText(/indsamler bevidst ikke din IP-adresse/)
  ).toBeVisible();
});
