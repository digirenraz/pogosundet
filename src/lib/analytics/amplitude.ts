"use client";

// Amplitude product analytics wrapper. Nothing here runs until `initAnalytics`
// is called, which only happens after the user grants consent (see
// AnalyticsProvider + consent.ts). All public functions no-op when analytics
// is not initialised, so call sites can fire events unconditionally.
//
// GDPR posture: EU data region, no IP collection, no PII in event properties,
// dynamic id segments stripped from page paths.
//
// The SDK (~70 KB gzipped) is loaded lazily via dynamic import() inside
// initAnalytics — only after consent is granted — so it never lands in the
// first-load bundle of every page. The import below is type-only (erased at
// build time) and adds no runtime weight.

import type * as AmplitudeBrowser from "@amplitude/analytics-browser";

// The full event vocabulary. Keeping it a union stops typos and documents
// everything we track in one place.
export type AnalyticsEvent =
  | "page_view"
  | "account_created"
  | "profile_completed"
  | "raid_created"
  | "raid_joined"
  | "dm_sent"
  | "channel_message_sent"
  | "reaction_added"
  | "player_search"
  | "profile_viewed"
  | "channel_opened";

// `sdk` holds the resolved Amplitude module once the dynamic import completes.
// `loadPromise` dedupes concurrent initAnalytics calls and lets track() calls
// fired in the same tick as consent flush once the SDK has loaded.
let sdk: typeof AmplitudeBrowser | null = null;
let loadPromise: Promise<void> | null = null;

export function initAnalytics(): Promise<void> {
  if (loadPromise) return loadPromise;

  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey) return Promise.resolve(); // No key configured → analytics stays disabled.

  loadPromise = import("@amplitude/analytics-browser")
    .then((mod) => {
      mod.init(apiKey, {
        // EU data residency — required for GDPR.
        serverZone: "EU",
        // Do not collect IP addresses.
        trackingOptions: { ipAddress: false },
        // We fire every event explicitly; disable all autocapture (page views,
        // form interactions, element clicks, attribution) to avoid silently
        // collecting field contents or marketing identifiers.
        autocapture: false,
      });
      sdk = mod;
    })
    .catch((err) => {
      // Chunk failed to load (e.g. offline) — leave analytics disabled and
      // allow a later initAnalytics() to retry.
      loadPromise = null;
      console.error("[analytics] failed to load Amplitude", err);
    });

  return loadPromise;
}

export function isAnalyticsReady(): boolean {
  return sdk !== null;
}

export function track(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean>,
): void {
  // SDK already loaded → fire immediately.
  if (sdk) {
    sdk.track(event, properties);
    return;
  }
  // Consent just granted and the SDK is still loading → flush once it's ready.
  // (loadPromise always resolves — load failures are swallowed above.)
  if (loadPromise) {
    void loadPromise.then(() => sdk?.track(event, properties));
  }
  // Otherwise (no consent / no key) → drop the event.
}

// Replace UUID path segments with ":id" so a page_view never carries a
// specific user/raid/profile identifier (e.g. /players/<uuid> → /players/:id).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizePath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => (UUID_RE.test(segment) ? ":id" : segment))
    .join("/");
}
