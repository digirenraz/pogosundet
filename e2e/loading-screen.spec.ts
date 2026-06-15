import { test, expect } from "@playwright/test";

// The "Direction B / Sundet" loading screen ships in the SSR HTML so it paints
// instantly on a cold app open; InitialSplash then unmounts it once React hydrates.

test("loading screen is in the SSR HTML on cold app open", async ({ request }) => {
  const res = await request.get("/");
  expect(res.ok()).toBe(true);
  const html = await res.text();

  expect(html).toContain('aria-label="Indlæser"');
  expect(html).toContain("Leder efter lokale trænere");
});

test("loading screen unmounts after the app hydrates", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status", { name: "Indlæser" })).toHaveCount(0);
});
