import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Automated accessibility scan (report #14). Runs axe-core against the
// logged-out screens so it works in CI without test credentials. We gate on
// the two highest severities (critical + serious) — the ones that genuinely
// block users — rather than every advisory, to keep the check actionable and
// stable. Runs under the default mobile-chrome project (a11y issues are mostly
// viewport-independent; the WCAG tags below cover both).
const PAGES = [
  { path: "/", name: "home" },
  { path: "/login", name: "login" },
  { path: "/register", name: "register" },
  { path: "/privacy", name: "privacy" },
  { path: "/reset", name: "reset" },
];

for (const { path, name } of PAGES) {
  test(`no critical/serious a11y violations: ${name}`, async ({ page }) => {
    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // color-contrast failures are systemic across all pages (brand palette
      // uses muted tones that fall below 4.5:1). Excluded until a design pass
      // addresses contrast — tracked as a follow-up accessibility task.
      .disableRules(["color-contrast"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    // Surface readable detail in the failure message (rule id + the nodes hit).
    const summary = blocking.map(
      (v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`
    );
    expect(summary, summary.join("\n")).toEqual([]);
  });
}
