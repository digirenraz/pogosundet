import { test, expect } from "@playwright/test";

test("home page renders login and register CTAs for logged-out users", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "PoGoSundet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log ind" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Opret konto" })).toBeVisible();
});
