import { test, expect } from "@playwright/test";

test("home page renders login and register CTAs for logged-out users", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "PoGoSundet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log ind" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Opret konto" })).toBeVisible();
});

test("PWA manifest and icons are wired up", async ({ page, request }) => {
  await page.goto("/");

  const appleIcon = page.locator('link[rel="apple-touch-icon"]');
  await expect(appleIcon).toHaveAttribute("href", "/icon-192.png");

  const manifestResponse = await request.get("/manifest.json");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.icons).toEqual([
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ]);

  for (const path of ["/icon-192.png", "/icon-512.png"]) {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
});
