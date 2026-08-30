import { test, expect } from "@playwright/test";

// Mirrors the login page's ordering fix (see e2e/login-layout.spec.ts):
// "Fortsæt med Google" is the primary path, so it renders above the
// email/password fields here too.

test("Google sign-up renders above the email/password fields", async ({ page }) => {
  await page.goto("/register");

  const googleBox = await page
    .getByRole("button", { name: "Fortsæt med Google" })
    .boundingBox();
  const emailBox = await page.getByLabel("E-mail").boundingBox();

  expect(googleBox).not.toBeNull();
  expect(emailBox).not.toBeNull();
  expect(googleBox!.y).toBeLessThan(emailBox!.y);
});
