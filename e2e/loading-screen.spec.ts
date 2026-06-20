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

// The core claim: the loading indicator paints immediately on a cold open,
// before any client-side auth or data fetching resolves. Because it ships in the
// SSR HTML (see the first test), it must be visible essentially as soon as the
// document commits — well under 200ms of navigation.
test("loading indicator is visible within 200ms of navigation", async ({ page }) => {
  // Warm the route once so the dev server's first-compile cost — which production
  // never pays (it serves precompiled HTML) — doesn't pollute the measurement.
  await page.goto("/", { waitUntil: "domcontentloaded" });

  // Re-open from a blank page and time how soon the SSR loading indicator shows.
  await page.goto("about:blank");
  const start = Date.now();
  await page.goto("/", { waitUntil: "commit" });
  await expect(page.getByRole("status", { name: "Indlæser" })).toBeVisible({
    timeout: 200,
  });
  expect(Date.now() - start).toBeLessThan(200);
});
