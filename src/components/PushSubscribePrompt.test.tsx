import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import daMessages from '../../messages/da.json';

// Mock the push helpers — the test drives the LIVE browser status the prompt
// gates on, plus the subscribe call.
const getPushStatus = vi.fn();
const subscribeToPush = vi.fn();
vi.mock('@/lib/push/subscription-helpers', () => ({
  getPushStatus: () => getPushStatus(),
  subscribeToPush: (userId: string) => subscribeToPush(userId),
}));

import { PushSubscribePrompt } from './PushSubscribePrompt';

function renderPrompt() {
  return render(
    <NextIntlClientProvider locale="da" messages={daMessages}>
      <PushSubscribePrompt userId="u1" />
    </NextIntlClientProvider>
  );
}

// Pretend we're an installed standalone PWA so the prompt isn't gated out.
function asStandalonePWA() {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('standalone'),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('PushSubscribePrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    getPushStatus.mockReset();
    subscribeToPush.mockReset();
    asStandalonePWA();
  });

  it('shows the prompt when the live browser subscription is missing (e.g. after a PWA reinstall)', async () => {
    getPushStatus.mockResolvedValue('unsubscribed');
    renderPrompt();
    expect(await screen.findByText(daMessages.Raids.pushPrompt.title)).toBeInTheDocument();
  });

  it('stays hidden when the device already has a live subscription', async () => {
    getPushStatus.mockResolvedValue('subscribed');
    renderPrompt();
    // Give the effect time to resolve, then assert it never appears.
    await waitFor(() => expect(getPushStatus).toHaveBeenCalled());
    expect(screen.queryByText(daMessages.Raids.pushPrompt.title)).not.toBeInTheDocument();
  });

  it('stays hidden when permission was denied', async () => {
    getPushStatus.mockResolvedValue('denied');
    renderPrompt();
    await waitFor(() => expect(getPushStatus).toHaveBeenCalled());
    expect(screen.queryByText(daMessages.Raids.pushPrompt.title)).not.toBeInTheDocument();
  });

  it('subscribes when the user taps allow', async () => {
    getPushStatus.mockResolvedValue('unsubscribed');
    subscribeToPush.mockResolvedValue({ error: null });
    renderPrompt();
    fireEvent.click(await screen.findByText(daMessages.Raids.pushPrompt.allow));
    await waitFor(() => expect(subscribeToPush).toHaveBeenCalledWith('u1'));
  });
});
