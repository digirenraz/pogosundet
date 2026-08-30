import { test, expect } from "@playwright/test";

// The Hero component (login/register/reset/home) floats the app-icon badge
// over the bottom edge of the hero photo. Regression coverage for a bug where
// the badge showed a generic Swords glyph instead of the real branded app
// icon, and — because the hero's `relative` positioning made it paint above
// its non-positioned sibling in CSS's stacking order — the hero image visibly
// clipped the top of the badge underneath it.

test("login hero badge shows the branded app icon and stacks above the hero photo", async ({
  page,
}) => {
  await page.goto("/login");

  const badge = page.getByTestId("hero-logo");
  await expect(badge).toBeVisible();

  // Real app icon, not the old Swords placeholder glyph.
  await expect(badge.locator("img")).toHaveAttribute("src", /icon-512\.png/);

  // Explicit stacking context above the hero photo — without this the badge
  // renders behind the hero's `relative` container despite coming later in
  // the DOM, and the photo clips its top edge.
  await expect(badge).toHaveCSS("position", "relative");
  await expect(badge).toHaveCSS("z-index", "10");
});
