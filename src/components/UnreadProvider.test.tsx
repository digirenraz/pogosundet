import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { UnreadProvider } from './UnreadProvider';

// usePathname is read fresh on every render via this mutable holder. Its name
// must start with "mock" so Vitest's vi.mock hoisting is allowed to reference it.
const mockPathname = { current: '/chat' };
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname.current,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getClaims: () => Promise.resolve({ data: { claims: { sub: 'user-1' } } }) },
  }),
}));

const mockClearChannel = vi.fn();
const mockClearPartner = vi.fn();

vi.mock('@/lib/chat/use-channel-unread', () => ({
  useChannelUnread: () => ({
    total: 0,
    clearChannel: mockClearChannel,
    counts: { generelt: 0, feedback: 0 },
    latestByChannel: { generelt: null, feedback: null },
  }),
}));

vi.mock('@/lib/dm/use-dm-unread', () => ({
  useDMUnread: () => ({ total: 0, clearPartner: mockClearPartner }),
}));

vi.mock('@/lib/hooks/use-mounted', () => ({
  useMounted: () => true,
}));

vi.mock('@/lib/push/app-badge', () => ({
  setBadge: vi.fn(),
  writeBadgeCount: vi.fn(),
}));

// Mounts the provider on `route` and flushes pending effects/microtasks (the
// userId-resolving auth.getClaims() promise) before assertions run.
async function renderAt(route: string) {
  mockPathname.current = route;
  render(<UnreadProvider>{null}</UnreadProvider>);
  await act(async () => {
    await Promise.resolve();
  });
}

// Regression coverage for #105: UnreadProvider exposed clearChannel/clearPartner
// from its unread hooks, but nothing ever called them — markChannelRead/markDMRead
// only bump last_read_at server-side and never reach the provider's live in-memory
// counts. So `total` (which drives the BottomNav badge and the home-screen icon
// badge) climbed forever and never reset after the user actually read a
// conversation. These tests pin the navigation → clear wiring that fixes that.
describe('UnreadProvider — clears unread counts on navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.current = '/chat';
  });

  it('clears the matching channel when navigating into it', async () => {
    await renderAt('/chat/generelt');
    expect(mockClearChannel).toHaveBeenCalledWith('generelt');
    expect(mockClearPartner).not.toHaveBeenCalled();
  });

  it('clears the matching DM partner when navigating into a conversation', async () => {
    await renderAt('/chat/dm/partner-abc');
    expect(mockClearPartner).toHaveBeenCalledWith('partner-abc');
    expect(mockClearChannel).not.toHaveBeenCalled();
  });

  it('clears nothing on the channel list page', async () => {
    await renderAt('/chat');
    expect(mockClearChannel).not.toHaveBeenCalled();
    expect(mockClearPartner).not.toHaveBeenCalled();
  });

  it('clears nothing for an unknown channel slug', async () => {
    await renderAt('/chat/not-a-real-channel');
    expect(mockClearChannel).not.toHaveBeenCalled();
    expect(mockClearPartner).not.toHaveBeenCalled();
  });

  it('clears nothing on unrelated routes', async () => {
    await renderAt('/raids');
    expect(mockClearChannel).not.toHaveBeenCalled();
    expect(mockClearPartner).not.toHaveBeenCalled();
  });
});
