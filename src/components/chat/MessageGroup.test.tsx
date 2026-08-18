import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import daMessages from '../../../messages/da.json';
import { MessageGroupView } from './MessageGroup';
import type { ChatMessage } from '@/lib/chat/types';

// Covers the two renderer changes made for the event bot. Both land in channel
// chat, raid chat AND DMs, since all three share this component — so a
// regression here is a three-surface regression.

const ME = 'me-1';
const OTHER = 'other-1';

function message(body: string, authorId = OTHER): ChatMessage {
  return {
    id: 'm1',
    author_id: authorId,
    body,
    sent_at: new Date('2026-08-16T18:30:00Z'),
    reply_to_id: null,
    reactions: {},
    profiles: {
      trainer_name: 'PoGoSundet',
      avatar_url: null,
      team: 'mystic',
      level: 40,
    },
  };
}

function renderGroup(body: string, authorId = OTHER) {
  return render(
    <NextIntlClientProvider locale="da" messages={daMessages}>
      <MessageGroupView
        group={{ author_id: authorId, messages: [message(body, authorId)] }}
        mine={authorId === ME}
        isLastOwnGroup={false}
        messagesById={{}}
        currentUserId={ME}
        highlightedId={null}
        onTap={() => {}}
        onReactToggle={() => {}}
      />
    </NextIntlClientProvider>
  );
}

describe('MessageGroupView rendering', () => {
  it('preserves line breaks in a multi-line message', () => {
    // Without `whitespace-pre-wrap` the bot's name / time / link lines collapse
    // into one run-on paragraph.
    const { container } = renderGroup('linje et\nlinje to\nlinje tre');

    const bubble = container.querySelector('button');
    expect(bubble?.className).toContain('whitespace-pre-wrap');
    expect(bubble?.textContent).toBe('linje et\nlinje to\nlinje tre');
  });

  it('renders a URL in the body as a real link', () => {
    renderGroup('⚔️ Groudon\nhttps://leekduck.com/events/groudon/');

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://leekduck.com/events/groudon/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('leaves an ordinary message without links untouched', () => {
    renderGroup('Almindelig besked uden links');

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Almindelig besked uden links')).toBeVisible();
  });

  it('does not turn message text into markup', () => {
    const { container } = renderGroup('<b>ikke fed</b> & <script>alert(1)</script>');

    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('button')?.textContent).toBe(
      '<b>ikke fed</b> & <script>alert(1)</script>'
    );
  });

  it('applies the same treatment to my own messages', () => {
    // The change is in the shared bubble, so it must hold for both sides.
    const { container } = renderGroup('mit link https://pogosundet.vercel.app', ME);

    expect(container.querySelector('button')?.className).toContain('whitespace-pre-wrap');
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://pogosundet.vercel.app');
  });
});
