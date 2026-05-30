"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMounted } from "@/lib/hooks/use-mounted";
import { setStoredConsent, useConsent } from "@/lib/analytics/consent";

// Bottom-anchored opt-in banner for product analytics. Shown only until the
// user makes a choice (consent === null). Acceptér grants consent (Amplitude
// then initialises via AnalyticsProvider); Afvis records a denial so analytics
// never loads. The choice persists, so the banner does not reappear.
export function ConsentBanner() {
  const t = useTranslations("Consent");
  const mounted = useMounted();
  const consent = useConsent();

  // Don't render in SSR/first paint (localStorage unavailable) or once decided.
  if (!mounted || consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label={t("ariaLabel")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur"
    >
      <div className="mx-auto flex max-w-md flex-col gap-3">
        <p className="text-sm text-foreground">
          {t("message")}{" "}
          <Link href="/privacy" className="underline">
            {t("privacyLink")}
          </Link>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStoredConsent("denied")}
            className="flex-1 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground"
          >
            {t("decline")}
          </button>
          <button
            type="button"
            onClick={() => setStoredConsent("granted")}
            className="flex-1 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
