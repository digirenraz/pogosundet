import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { PlayerCard } from './PlayerCard';
import type { Profile } from '@/lib/profile/helpers';
import daMessages from '../../messages/da.json';

function renderCard(profile: Profile) {
  return render(
    <NextIntlClientProvider locale="da" messages={daMessages}>
      <PlayerCard profile={profile} />
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
