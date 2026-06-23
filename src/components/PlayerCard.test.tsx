import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { PlayerCard } from './PlayerCard';
import type { Profile } from '@/lib/profile/helpers';
import daMessages from '../../messages/da.json';

function renderCard(profile: Profile, props: { added?: boolean } = {}) {
  return render(
    <NextIntlClientProvider locale="da" messages={daMessages}>
      <PlayerCard profile={profile} added={props.added} />
    </NextIntlClientProvider>
  );
}

const base = {
  id: '1',
  user_id: 'u1',
  trainer_name: 'Alpha',
  friend_code: '1111 2222 3333',
} as unknown as Profile;

describe('PlayerCard friend-code visibility (issue #101)', () => {
  it('shows the friend code and a copy button when not hidden', () => {
    renderCard({ ...base, hide_friend_code: false });
    expect(screen.getByText('1111 2222 3333')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kopier/ })).toBeInTheDocument();
  });

  it('shows the placeholder and no code/copy button when hidden', () => {
    renderCard({ ...base, hide_friend_code: true });
    expect(screen.queryByText('1111 2222 3333')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Kopier/ })).not.toBeInTheDocument();
    expect(screen.getByText('Ønsker ikke nye venner lige nu')).toBeInTheDocument();
  });
});

describe('PlayerCard "already added" hint (scan-session persistence)', () => {
  it('shows the hint when added is true', () => {
    renderCard({ ...base, hide_friend_code: false }, { added: true });
    expect(screen.getByText('Allerede tilføjet')).toBeInTheDocument();
  });

  it('hides the hint by default', () => {
    renderCard({ ...base, hide_friend_code: false });
    expect(screen.queryByText('Allerede tilføjet')).not.toBeInTheDocument();
  });
});
