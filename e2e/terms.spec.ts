import { test, expect } from "@playwright/test";

// The terms of use page is public (logged-out users reach it from the register
// consent checkbox, alongside the privacy policy). Added 2026-08-30 alongside
// the pogosundet.dk custom-domain wiring (Google OAuth consent screen review
// prompted adding a ToS).
test("terms of use page renders", async ({ page }) => {
  await page.goto("/terms");

  await expect(page.getByRole("heading", { name: "Vilkår for brug" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "1. Om tjenesten" })
  ).toBeVisible();
});

test("register consent checkbox links to both privacy policy and terms of use", async ({
  page,
}) => {
  await page.goto("/register");

  const consentLabel = page.locator("label", { hasText: "Jeg accepterer" });
  await expect(consentLabel.getByRole("link", { name: "privatlivspolitikken" })).toHaveAttribute(
    "href",
    "/privacy"
  );
  await expect(
    consentLabel.getByRole("link", { name: "vilkårene for brug" })
  ).toHaveAttribute("href", "/terms");
});
