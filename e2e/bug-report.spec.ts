import { test, expect } from "@playwright/test";

// Requires an existing test account with a profile already created.
const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Bug report (Rapportér en fejl)", () => {
  test.skip(!EMAIL || !PASSWORD, "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not configured");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/E-mail/i).fill(EMAIL!);
    await page.getByLabel(/Adgangskode/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /^Log ind$/ }).click();
    await page.waitForURL(/\/players$/);
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
    await page.getByLabel("Beskrivelse").fill("Dette er en automatisk testrapport fra e2e-suiten.");
    await expect(send).toBeEnabled();

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
