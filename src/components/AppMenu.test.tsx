import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { AppMenu } from './AppMenu';
import { CHANGELOG_ENTRIES } from '@/lib/changelog/entries';
import daMessages from '../../messages/da.json';

// Renders AppMenu with the real Danish messages so the test pins the actual
// user-facing strings ("Menu", "Nyheder", "Luk").
function renderAppMenu() {
  return render(
    <NextIntlClientProvider locale="da" messages={daMessages}>
      <AppMenu />
    </NextIntlClientProvider>
  );
}

describe('AppMenu', () => {
  it('renders the hamburger button with its aria-label', () => {
    renderAppMenu();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
  });

  it('shows the "Nyheder" menu item when the hamburger is clicked', () => {
    renderAppMenu();

    expect(screen.queryByText('Nyheder')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByText('Nyheder')).toBeInTheDocument();
  });

  it('shows the "Rapportér en fejl" menu item when the hamburger is clicked', () => {
    renderAppMenu();

    expect(screen.queryByText('Rapportér en fejl')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByText('Rapportér en fejl')).toBeInTheDocument();
  });

  it('opens the changelog sheet from the menu and lazy-loads the entries', async () => {
    renderAppMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nyheder' }));

    // The dynamic import('@/lib/changelog/entries') resolves in jsdom — the
    // newest entry's text must appear in the sheet.
    expect(await screen.findByText(CHANGELOG_ENTRIES[0].text)).toBeInTheDocument();
    // Sheet chrome: title + close button.
    expect(screen.getByRole('heading', { name: 'Nyheder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Luk' })).toBeInTheDocument();
  });

  it('closes the sheet via the close button', async () => {
    renderAppMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nyheder' }));
    await screen.findByText(CHANGELOG_ENTRIES[0].text);

    fireEvent.click(screen.getByRole('button', { name: 'Luk' }));
    expect(screen.queryByText(CHANGELOG_ENTRIES[0].text)).not.toBeInTheDocument();
  });
});
