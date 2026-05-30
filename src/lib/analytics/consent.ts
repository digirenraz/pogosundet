"use client";

// Analytics consent state, backed by localStorage. GDPR/ePrivacy: product
// analytics (Amplitude) is non-essential, so it stays off until the user
// actively opts in. This module is the single source of truth for that choice.
//
// `null`      → not yet decided (show the consent banner)
// `"granted"` → user opted in (Amplitude may initialise)
// `"denied"`  → user opted out (Amplitude must never load)

import { useSyncExternalStore } from "react";

export type ConsentValue = "granted" | "denied";

const STORAGE_KEY = "pogo-analytics-consent";

// In-memory listeners so every mounted hook re-renders the instant the choice
// changes (the native `storage` event only fires cross-tab, not same-tab).
const listeners = new Set<() => void>();

export function getStoredConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "granted" || value === "denied" ? value : null;
}

export function setStoredConsent(value: ConsentValue): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Returns the current consent choice, reactively. `null` on the server and
// until the first client render (so the banner never flashes in SSR HTML).
export function useConsent(): ConsentValue | null {
  return useSyncExternalStore(subscribe, getStoredConsent, () => null);
}
