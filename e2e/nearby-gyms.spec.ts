import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile already created.
const EMAIL = process.env.E2E_TEST_EMAIL;

test.describe("Nearby gym suggestions (raid form)", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  // Mobile viewport (the raid form is the same component at all widths) with
  // the geolocation permission pre-granted at a position in central
  // Frederikssund, so the hook locates silently — no permission prompt.
  test.use({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 55.8396, longitude: 12.0689 },
    permissions: ["geolocation"],
  });

  // IMPORTANT: this spec never submits the form — it only exercises the gym
  // field's suggestion dropdown (the shared DB must not get a test raid).
  test("suggests nearby gyms before typing and filters while typing", async ({ page }) => {
    await page.goto("/raids/new");

    const gymInput = page.getByPlaceholder("Søg gym...");
    await gymInput.click();

    // Empty query: the nearby group appears with at least one suggestion row
    // carrying a distance label ("350 m" / "1,2 km") — the gyms table is
    // seeded with coordinates in the shared DB.
    const dropdown = page.getByTestId("gym-suggestions");
    await expect(dropdown.getByText("I nærheden")).toBeVisible();
    await expect(
      dropdown.getByText(/^\d+ m$|^\d+,\d km$/).first()
    ).toBeVisible();

    // Typing ≥2 chars switches to filtered matches.
    await gymInput.fill("sø");
    await expect(dropdown.getByText("I nærheden")).not.toBeVisible();
    const matches = dropdown.getByRole("button", { name: /sø/i });
    await expect(matches.first()).toBeVisible();

    // Nothing is submitted — the page is left without posting a raid.
  });
});
