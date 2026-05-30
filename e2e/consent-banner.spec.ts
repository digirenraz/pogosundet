import { test, expect } from "@playwright/test";

// The analytics consent banner (opt-in) is mounted in the [locale] layout, so it
// shows on every page until the user makes a choice. The choice persists in
// localStorage, so the banner must not reappear. These tests guard that
// behaviour; they do NOT exercise real Amplitude requests (no API key in CI —
// analytics no-ops without one).

const dialog = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "Samtykke til analyse" });

test.beforeEach(async ({ context }) => {
  // Start every test from a fresh, undecided state.
  await context.clearCookies();
});

test("banner appears on first visit", async ({ page }) => {
  await page.goto("/");
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Acceptér" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Afvis" })).toBeVisible();
});

test("accepting dismisses the banner and the choice persists across reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(dialog(page)).toBeVisible();

  await page.getByRole("button", { name: "Acceptér" }).click();
  await expect(dialog(page)).toHaveCount(0);

  // localStorage records the granted choice.
  expect(
    await page.evaluate(() => localStorage.getItem("pogo-analytics-consent"))
  ).toBe("granted");

  await page.reload();
  await expect(dialog(page)).toHaveCount(0);
});

test("declining dismisses the banner and the choice persists across reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(dialog(page)).toBeVisible();

  await page.getByRole("button", { name: "Afvis" }).click();
  await expect(dialog(page)).toHaveCount(0);

  expect(
    await page.evaluate(() => localStorage.getItem("pogo-analytics-consent"))
  ).toBe("denied");

  await page.reload();
  await expect(dialog(page)).toHaveCount(0);
});
