import { test, expect } from "@playwright/test";

// Two login-screen layout requirements:
// 1. "Fortsæt med Google" is the primary path, so it renders above the
//    email/password fields (not below them).
// 2. The page content was compacted (smaller hero, no mt-auto footer pin) so
//    that on a typical phone viewport the submit button and "Opret konto"
//    link land above fixed bottom overlays (the analytics consent banner,
//    and — on Android Chrome — the PWA install prompt) instead of being
//    permanently hidden behind them. The consent banner is the one of the
//    two we can reliably trigger in CI (the install prompt needs a real
//    `beforeinstallprompt`, which Chromium won't fire here), so it stands in
//    as the regression guard for "a fixed bottom banner must not cover the
//    form."

test("Google sign-in renders above the email/password fields", async ({ page }) => {
  await page.goto("/login");

  const googleTop = await page
    .getByRole("button", { name: "Fortsæt med Google" })
    .boundingBox();
  const emailTop = await page.getByLabel("E-mail").boundingBox();

  expect(googleTop).not.toBeNull();
  expect(emailTop).not.toBeNull();
  expect(googleTop!.y).toBeLessThan(emailTop!.y);
});

test("submit button and footer link clear the consent banner", async ({ page }) => {
  await page.goto("/login");

  const consentDialog = page.getByRole("dialog", { name: "Samtykke til analyse" });
  await expect(consentDialog).toBeVisible();
  const bannerBox = await consentDialog.boundingBox();
  expect(bannerBox).not.toBeNull();

  const submitBox = await page.getByRole("button", { name: "Log ind" }).boundingBox();
  const footerLinkBox = await page.getByRole("link", { name: "Opret konto" }).boundingBox();
  expect(submitBox).not.toBeNull();
  expect(footerLinkBox).not.toBeNull();

  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(bannerBox!.y);
  expect(footerLinkBox!.y + footerLinkBox!.height).toBeLessThanOrEqual(bannerBox!.y);
});
