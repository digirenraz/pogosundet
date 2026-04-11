import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// Loads the message file for the active locale on every server request.
// Falls back to the default locale if none is present or unrecognised.
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
