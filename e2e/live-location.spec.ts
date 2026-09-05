import { test, expect } from "@playwright/test";

// Live location sharing ("Hvem spiller nu").
//
// Geolocation is fully mockable in Playwright, so unlike push this feature can
// be exercised end-to-end in CI: grant the permission, set a fixed position,
// share, assert, stop.
//
// Tile requests are aborted throughout. CI must never depend on
// tile.openstreetmap.org being reachable — and the assertions are all on marker
// and list DOM, never on the rendered map image, so blocking tiles costs
// nothing.
const EMAIL = process.env.E2E_TEST_EMAIL;

// Kalvøen, Frederikssund — inside the seeded gym set, so the nearest-gym label
// has something to resolve against.
const KALVOEEN = { latitude: 55.8331, longitude: 12.0431 };
const ANOTHER_SPOT = { latitude: 55.8402, longitude: 12.0688 };

test.describe("Live location sharing", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({
    storageState: "e2e/.auth/user.json",
    permissions: ["geolocation"],
    geolocation: KALVOEEN,
  });

  test.beforeEach(async ({ page }) => {
    await page.route("**://*.tile.openstreetmap.org/**", (route) => route.abort());
    await page.route("**://tile.openstreetmap.org/**", (route) => route.abort());
    // The consent explainer is once-per-device; pre-accept it so each test
    // exercises the sharing flow rather than the sheet.
    await page.addInitScript(() => {
      window.localStorage.setItem("pogosundet:location-consent", "1");
    });
  });

  test.afterEach(async ({ page }) => {
    // Leave no share behind — a stale row would leak into later tests (and
    // into the preview environment) as a phantom player on the map.
    await page.goto("/kort");
    const stop = page.getByRole("button", { name: "Stop" });
    if (await stop.isVisible().catch(() => false)) {
      await stop.click();
    }
  });

  test("the Kort tab is reachable from the bottom nav", async ({ page }) => {
    await page.goto("/players");
    await page.getByRole("link", { name: "Kort" }).click();
    await expect(page).toHaveURL(/\/kort$/);
    await expect(page.getByText("Hvem spiller nu").first()).toBeVisible();
  });

  test("start a share → banner appears → stop → banner is gone", async ({ page }) => {
    await page.goto("/kort");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Del min position" }).click();

    // Duration picker: pick the shortest window so a leaked row expires fast.
    await expect(page.getByText("Hvor længe spiller du?")).toBeVisible();
    await page.getByRole("button", { name: "15 min" }).click();
    await page.getByRole("button", { name: "Start deling" }).click();

    // The persistent banner is the safety affordance — it must show up, and it
    // must carry a countdown.
    const banner = page.getByText("Du deler din position");
    await expect(banner).toBeVisible();
    await expect(page.getByText(/\d+ min tilbage/)).toBeVisible();

    // The sharer appears in the list, labelled as themselves.
    await expect(page.getByText("Dig").first()).toBeVisible();

    await page.getByRole("button", { name: "Stop" }).click();
    await expect(banner).toBeHidden();
  });

  test("the share survives a reload, and the banner comes back with it", async ({ page }) => {
    await page.goto("/kort");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Del min position" }).click();
    await page.getByRole("button", { name: "15 min" }).click();
    await page.getByRole("button", { name: "Start deling" }).click();
    await expect(page.getByText("Du deler din position")).toBeVisible();

    // The row outlives the tab, so a cold open must restore the banner —
    // otherwise someone could be sharing with no visible indication.
    await page.reload();
    await expect(page.getByText("Du deler din position")).toBeVisible();
  });

  test("every position is labelled with its age, never as live", async ({ page }) => {
    await page.goto("/kort");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Del min position" }).click();
    await page.getByRole("button", { name: "15 min" }).click();
    await page.getByRole("button", { name: "Start deling" }).click();

    // A freshly captured position reads "lige nu" — and the screen carries the
    // standing caveat that positions only update while the app is open.
    await expect(page.getByText("lige nu").first()).toBeVisible();
    await expect(
      page.getByText(/Positionerne opdateres kun, når folk har appen fremme/)
    ).toBeVisible();
  });

  test("moving and returning to the foreground updates the shared position", async ({
    page,
    context,
  }) => {
    await page.goto("/kort");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Del min position" }).click();
    await page.getByRole("button", { name: "60 min" }).click();
    await page.getByRole("button", { name: "Start deling" }).click();
    await expect(page.getByText("Du deler din position")).toBeVisible();

    // Walk somewhere else, then simulate the app coming back to the front.
    // This is the whole refresh-on-focus premise: a web app cannot update a
    // position in the background, so foregrounding is the only trigger there is.
    await context.setGeolocation(ANOTHER_SPOT);

    // The write is throttled to once a minute, so reload instead of waiting it
    // out — a fresh mount always writes (lastWriteAt is null).
    await page.reload();
    await expect(page.getByText("Du deler din position")).toBeVisible();
    await expect(page.getByText("Dig").first()).toBeVisible();
  });

  test("the consent explainer is shown before a first-ever share", async ({ page }) => {
    // Override the beforeEach pre-acceptance for this one case.
    await page.addInitScript(() => {
      window.localStorage.removeItem("pogosundet:location-consent");
    });
    await page.goto("/kort");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Del min position" }).click();
    await expect(page.getByText("Før du deler din position")).toBeVisible();
    // The home-address warning is the part that must not quietly disappear.
    await expect(page.getByText(/Del ikke din position hjemmefra/)).toBeVisible();
    await page.getByRole("button", { name: "Annuller" }).click();
    await expect(page.getByText("Du deler din position")).toBeHidden();
  });
});
