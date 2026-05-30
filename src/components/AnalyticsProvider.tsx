"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useConsent } from "@/lib/analytics/consent";
import { initAnalytics, normalizePath, track } from "@/lib/analytics/amplitude";
import { ConsentBanner } from "./ConsentBanner";

// Owns the analytics lifecycle: renders the consent banner, initialises
// Amplitude once (and only once) consent is granted, and fires page_view on
// client-side route changes. Mounted high in the [locale] layout so it sees
// every navigation. Renders no wrapper around children.
export function AnalyticsProvider() {
  const consent = useConsent();
  const pathname = usePathname();

  // Initialise as soon as consent is granted (or on later mounts if it was
  // already granted in a previous visit).
  useEffect(() => {
    // Fire-and-forget: initAnalytics lazy-loads the SDK chunk. track() calls
    // made before it resolves are queued and flushed by the wrapper.
    if (consent === "granted") void initAnalytics();
  }, [consent]);

  // page_view per route. normalizePath strips dynamic ids; query strings are
  // intentionally not included (they can carry search terms / PII).
  useEffect(() => {
    if (consent === "granted") {
      track("page_view", { path: normalizePath(pathname) });
    }
  }, [consent, pathname]);

  return <ConsentBanner />;
}
