import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// fake-indexeddb provides a spec-compliant in-memory IndexedDB for jsdom (which
// ships no real implementation). Isolated to this test file — never imported by
// app code.
import 'fake-indexeddb/auto';
import { clearBadge, readBadgeCount, setBadge, writeBadgeCount } from './app-badge';

describe('setBadge / clearBadge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not throw when navigator.setAppBadge is absent', async () => {
    // navigator with no Badging API methods (older browsers / non-installed).
    vi.stubGlobal('navigator', {});
    await expect(setBadge(3)).resolves.toBeUndefined();
    await expect(clearBadge()).resolves.toBeUndefined();
  });

  it('clamps negative values to 0 and 0 triggers clearAppBadge (not setAppBadge)', async () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { setAppBadge, clearAppBadge });

    await setBadge(-5);
    expect(setAppBadge).not.toHaveBeenCalled();
    expect(clearAppBadge).toHaveBeenCalledTimes(1);

    await setBadge(0);
    expect(setAppBadge).not.toHaveBeenCalled();
    expect(clearAppBadge).toHaveBeenCalledTimes(2);
  });

  it('calls setAppBadge with the count for positive values', async () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { setAppBadge, clearAppBadge });

    await setBadge(7);
    expect(setAppBadge).toHaveBeenCalledWith(7);
    expect(clearAppBadge).not.toHaveBeenCalled();
  });
});

describe('IndexedDB badge count store', () => {
  beforeEach(async () => {
    // Reset to a clean number between tests.
    await writeBadgeCount(0);
  });

  it('round-trips writeBadgeCount → readBadgeCount', async () => {
    await writeBadgeCount(12);
    await expect(readBadgeCount()).resolves.toBe(12);

    await writeBadgeCount(3);
    await expect(readBadgeCount()).resolves.toBe(3);
  });

  it('clamps negatives to 0 on write', async () => {
    await writeBadgeCount(-4);
    await expect(readBadgeCount()).resolves.toBe(0);
  });
});
