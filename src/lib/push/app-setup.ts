// Client-side reporting of "is this member set up to receive notifications?".
//
// Two things decide whether push actually reaches someone:
//   1. the app is installed to the home screen (mandatory on iOS, where Safari
//      refuses the Push API outside a home-screen install), and
//   2. the browser's notification permission is granted.
//
// Neither was recorded anywhere, so there was no way to see who was missing a
// step. This module reads both from the device on app open and reports them
// through the record_app_setup() RPC (migration 027). Browser-only — never
// import from a Server Component.
import type { SupabaseClient } from '@supabase/supabase-js';

export type SetupPlatform = 'ios' | 'android' | 'desktop' | 'other';
export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

/** localStorage key holding the last reported signature + timestamp. */
export const SETUP_REPORT_KEY = 'app-setup-reported';

/**
 * Re-report at most this often when nothing has changed. A changed signature
 * (installed, or permission granted) always reports immediately — the throttle
 * only suppresses the identical daily heartbeat.
 */
export const REPORT_INTERVAL_MS = 12 * 60 * 60 * 1000;

/**
 * Which device family this is. iPadOS 13+ reports a desktop Safari user agent,
 * so it is identified by the Macintosh UA *plus* a touch screen — the standard
 * workaround, and the reason maxTouchPoints is a parameter here.
 *
 * Only used to make a nudge actionable ("this person is on iOS and hasn't
 * installed" points at /onboarding/ios); nothing in the app branches on it.
 */
export function detectPlatform(
  userAgent: string,
  maxTouchPoints = 0
): SetupPlatform {
  if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios';
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  if (/Windows|Macintosh|X11|Linux/.test(userAgent)) return 'desktop';
  return 'other';
}

/**
 * The state we care about, collapsed to a short string. Reporting is driven by
 * this changing, so a member who installs the app or taps "Tillad" shows up on
 * the admin screen on their very next app open rather than up to 12h later.
 */
export function setupSignature(
  standalone: boolean,
  permission: PushPermission,
  platform: SetupPlatform
): string {
  return `${standalone ? 'pwa' : 'web'}:${permission}:${platform}`;
}

/**
 * Should we write to the database this app open? `stored` is the raw
 * localStorage value (`"<signature>|<epoch ms>"`), or null on a fresh device.
 *
 * Deliberately lenient about malformed stored values: anything we can't parse
 * means "report now and rewrite it", which self-heals rather than wedging a
 * device into never reporting again.
 */
export function shouldReport(
  stored: string | null,
  signature: string,
  now: number,
  intervalMs = REPORT_INTERVAL_MS
): boolean {
  if (!stored) return true;
  const separator = stored.lastIndexOf('|');
  if (separator === -1) return true;
  if (stored.slice(0, separator) !== signature) return true;
  const at = Number(stored.slice(separator + 1));
  if (!Number.isFinite(at)) return true;
  return now - at >= intervalMs;
}

/** Serialises what shouldReport() reads back. */
export function reportRecord(signature: string, now: number): string {
  return `${signature}|${now}`;
}

/** Reads the browser's current notification permission. */
export function readPushPermission(): PushPermission {
  if (typeof Notification === 'undefined' || !('PushManager' in window)) {
    return 'unsupported';
  }
  const permission = Notification.permission;
  return permission === 'granted' || permission === 'denied'
    ? permission
    : 'default';
}

/** Is the app running as an installed PWA rather than a browser tab? */
export function readStandalone(): boolean {
  // `navigator.standalone` is the iOS-only legacy flag; iOS Safari has
  // supported the display-mode media query since 16.4 but older installs still
  // report only the legacy one, and a member on an old install is exactly the
  // kind of person this feature exists to find.
  const legacy = (navigator as Navigator & { standalone?: boolean }).standalone;
  return (
    window.matchMedia('(display-mode: standalone)').matches || legacy === true
  );
}

/**
 * Reports this device's setup state, throttled. Resolves to whether a write
 * was actually made (used by the tests; callers ignore it).
 *
 * Never throws: a failed report must not break app start-up. It costs at most
 * one nudge going out a day late.
 */
export async function reportAppSetup(
  supabase: SupabaseClient,
  now: number = Date.now()
): Promise<boolean> {
  try {
    const standalone = readStandalone();
    const permission = readPushPermission();
    const platform = detectPlatform(
      navigator.userAgent,
      navigator.maxTouchPoints ?? 0
    );
    const signature = setupSignature(standalone, permission, platform);

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(SETUP_REPORT_KEY);
    } catch {
      // Private mode / storage disabled — fall through and report every open.
    }
    if (!shouldReport(stored, signature, now)) return false;

    const { error } = await supabase.rpc('record_app_setup', {
      p_standalone: standalone,
      p_push_permission: permission,
      p_platform: platform,
    });
    if (error) return false;

    try {
      localStorage.setItem(SETUP_REPORT_KEY, reportRecord(signature, now));
    } catch {
      // Same as above: worst case we report again on the next open.
    }
    return true;
  } catch {
    return false;
  }
}
