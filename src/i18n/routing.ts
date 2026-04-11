import { defineRouting } from "next-intl/routing";

// Single locale (Danish) for Phase 1.
// localePrefix: 'as-needed' means no /da/ prefix in URLs for the default locale —
// so routes are /login, /register, etc. (not /da/login).
// When English is added in a future phase, English URLs will be /en/login etc.
export const routing = defineRouting({
  locales: ["da"],
  defaultLocale: "da",
  localePrefix: "as-needed",
});
