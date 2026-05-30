"use client";

// Amplitude product analytics wrapper. Nothing here runs until `initAnalytics`
// is called, which only happens after the user grants consent (see
// AnalyticsProvider + consent.ts). All public functions no-op when analytics
// is not initialised, so call sites can fire events unconditionally.
//
// GDPR posture: EU data region, no IP collection, no PII in event properties,
// dynamic id segments stripped from page paths.

import * as amplitude from "@amplitude/analytics-browser";

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

let initialised = false;

export function initAnalytics(): void {
  if (initialised) return;

  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey) return; // No key configured → analytics stays disabled.

  amplitude.init(apiKey, {
    // EU data residency — required for GDPR.
    serverZone: "EU",
    // Do not collect IP addresses.
    trackingOptions: { ipAddress: false },
    // We fire every event explicitly; disable all autocapture (page views,
    // form interactions, element clicks, attribution) to avoid silently
    // collecting field contents or marketing identifiers.
    autocapture: false,
  });

  initialised = true;
}

export function isAnalyticsReady(): boolean {
  return initialised;
}

export function track(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean>,
): void {
  if (!initialised) return;
  amplitude.track(event, properties);
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
