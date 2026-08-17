import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import daMessages from '../../../messages/da.json';
import { ChannelListScreen } from './ChannelListScreen';
import type { OnlineStripProfile } from './OnlineStrip';

// The bot is excluded from `profiles` (getAllProfiles filters is_bot), so
// anything that resolves an author name from that list renders "—" for a bot
// message. The server-rendered preview is fine — it uses the PostgREST embed —
// but a Realtime INSERT carries no join, so the client needs `botProfiles`.
//
// This was fixed in ChannelScreen first and missed here; the test exists so the
// two don't drift apart again.

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/chat',
}));

vi.mock('@/lib/profile/use-presence', () => ({ usePresence: () => new Set<string>() }));
vi.mock('@/lib/chat/use-channel-list-typing', () => ({
  useChannelListTyping: () => ({ generelt: new Set(), feedback: new Set(), events: new Set() }),
}));
vi.mock('@/lib/dm/use-dm-list-realtime', () => ({
  useDMListRealtime: () => ({ latestByPartner: {}, unreadByPartner: {} }),
}));
vi.mock('@/lib/chat/use-channel-unread', () => ({
  useChannelUnread: () => ({
    counts: { generelt: 0, feedback: 0, events: 0 },
    clearChannel: vi.fn(),
    total: 0,
    // A live bot message, exactly as Realtime delivers it: no profile join.
    latestByChannel: {
      generelt: null,
      feedback: null,
      events: {
        id: 'm1',
        channel: 'events',
        user_id: 'bot-uuid',
        body: '⚔️ Groudon in 5-star Raid Battles',
        created_at: new Date().toISOString(),
        reply_to_id: null,
      },
    },
  }),
}));

const BOT: OnlineStripProfile = {
  user_id: 'bot-uuid',
  trainer_name: 'PoGoSundet',
  avatar_url: null,
  team: null,
  level: null,
};

function renderList(botProfiles: OnlineStripProfile[] | undefined) {
  return render(
    <NextIntlClientProvider locale="da" messages={daMessages}>
      <ChannelListScreen
        entries={[
          {
            channel: { id: 'events', name: 'events', description: 'Nye raids' },
            lastMessage: null,
          },
        ]}
        profiles={[]}
        botProfiles={botProfiles}
        totalMembers={0}
        currentUserId="me"
        initialUnreadCounts={{ generelt: 0, feedback: 0, events: 0 }}
        dmEntries={[]}
      />
    </NextIntlClientProvider>
  );
}

describe('ChannelListScreen bot author names', () => {
  it('shows the bot name on a live message preview', () => {
    // Assert on the "<name>: <body>" preview line specifically — the app header
    // also renders the string "PoGoSundet".
    const { container } = renderList([BOT]);

    expect(container.textContent).toMatch(/PoGoSundet:\s*⚔️ Groudon/);
  });

  it('falls back to a dash when bot profiles are missing', () => {
    // Documents the failure this guards against, so the assertion above is
    // clearly load-bearing rather than incidentally passing.
    const { container } = renderList(undefined);

    expect(container.textContent).toMatch(/—:\s*⚔️ Groudon/);
    expect(container.textContent).not.toMatch(/PoGoSundet:\s*⚔️ Groudon/);
  });
});
