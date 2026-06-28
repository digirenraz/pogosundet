import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile already created.
const EMAIL = process.env.E2E_TEST_EMAIL;

test.describe("Bug report (Rapportér en fejl)", () => {
  test.skip(!EMAIL, "E2E_TEST_EMAIL not configured");
  test.use({ storageState: "e2e/.auth/user.json" });

  // The hamburger menu is mobile-only (lg:hidden), and the bug this spec
  // guards against (send button painted over by the fixed BottomNav — found
  // on prod 2026-06-10) only reproduces with the BottomNav visible, i.e.
  // below the lg breakpoint.
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/players");
  });

  test("submits a bug report from the hamburger menu (API stubbed)", async ({ page }) => {
    // Stub the API BEFORE submitting so NO real GitHub issue is ever created.
    await page.route("**/api/bug-report", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      })
    );

    // Hamburger at the left edge of the /players header → bug-report item.
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Rapportér en fejl" }).click();

    // Sheet: heading + form. The send button stays disabled until both
    // fields are valid.
    await expect(page.getByRole("heading", { name: "Rapportér en fejl" })).toBeVisible();
    const send = page.getByRole("button", { name: "Send" });
    await expect(send).toBeDisabled();

    await page.getByLabel("Titel").fill("E2E-testrapport");
    await expect(send).toBeDisabled(); // description still missing

    // A too-short description explains itself instead of silently keeping
    // the button disabled (prod confusion, 2026-06-10).
    await page.getByLabel("Beskrivelse").fill("kort");
    await expect(
      page.getByText("Beskrivelsen skal være på mindst 10 tegn — skriv lidt mere.")
    ).toBeVisible();
    await page.getByLabel("Beskrivelse").fill("Dette er en automatisk testrapport fra e2e-suiten.");
    await expect(send).toBeEnabled();

    // Regression guard: the sheet renders in a body-level portal so the
    // BottomNav can't paint over the send button — it must be fully visible.
    await expect(send).toBeInViewport({ ratio: 1 });

    await send.click();

    // Thank-you state replaces the form.
    await expect(page.getByText("Tak!")).toBeVisible();
    await expect(
      page.getByText("Vi har modtaget din rapport og kigger på den hurtigst muligt.")
    ).toBeVisible();

    // Close via the "Luk" button — sheet disappears.
    await page.getByRole("button", { name: "Luk" }).last().click();
    await expect(page.getByRole("heading", { name: "Rapportér en fejl" })).not.toBeVisible();
  });
});
