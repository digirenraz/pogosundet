import { describe, expect, it } from 'vitest';
import {
  detectPlatform,
  reportRecord,
  setupSignature,
  shouldReport,
  REPORT_INTERVAL_MS,
} from './app-setup';

describe('detectPlatform', () => {
  it('identifies iPhone and iPad', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (iPad; CPU OS 16_4)')).toBe('ios');
  });

  it('identifies iPadOS, which pretends to be desktop Safari', () => {
    // iPadOS 13+ sends a Macintosh UA; the touch screen is what gives it away.
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15';
    expect(detectPlatform(ua, 5)).toBe('ios');
    expect(detectPlatform(ua, 0)).toBe('desktop');
  });

  it('identifies Android and desktop', () => {
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 7)')).toBe('android');
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
  });

  it('falls back to "other" for anything unrecognised', () => {
    expect(detectPlatform('SomeFutureBrowser/1.0')).toBe('other');
  });
});

describe('shouldReport', () => {
  const signature = setupSignature(true, 'granted', 'ios');
  const now = 1_700_000_000_000;

  it('reports on a device that has never reported', () => {
    expect(shouldReport(null, signature, now)).toBe(true);
  });

  it('skips an unchanged report inside the throttle window', () => {
    const stored = reportRecord(signature, now - 1000);
    expect(shouldReport(stored, signature, now)).toBe(false);
  });

  it('reports again once the throttle window has passed', () => {
    const stored = reportRecord(signature, now - REPORT_INTERVAL_MS);
    expect(shouldReport(stored, signature, now)).toBe(true);
  });

  it('reports immediately when the state changed, throttle or not', () => {
    // The whole point: someone who just tapped "Tillad" must show as set up
    // straight away, not up to 12 hours later.
    const stored = reportRecord(setupSignature(true, 'default', 'ios'), now);
    expect(shouldReport(stored, signature, now)).toBe(true);
  });

  it('reports when the stored value is malformed, rather than wedging', () => {
    expect(shouldReport('garbage', signature, now)).toBe(true);
    expect(shouldReport(`${signature}|not-a-number`, signature, now)).toBe(true);
  });
});

describe('setupSignature', () => {
  it('distinguishes every combination that matters', () => {
    const signatures = new Set([
      setupSignature(true, 'granted', 'ios'),
      setupSignature(false, 'granted', 'ios'),
      setupSignature(true, 'denied', 'ios'),
      setupSignature(true, 'granted', 'android'),
    ]);
    expect(signatures.size).toBe(4);
  });
});
