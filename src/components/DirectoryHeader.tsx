'use client';

import { useTranslations } from 'next-intl';
import { AppMenu } from '@/components/AppMenu';

// Fixed top header for the Player Directory.
// Logout used to live in a dropdown here; it now lives on the edit-profile page
// (below "Slet konto permanent"). The hamburger (AppMenu) opens the changelog.
// No lg:hidden wrapper needed — the whole mobile directory is already lg:hidden.
export function DirectoryHeader() {
  const t = useTranslations('PlayerDirectory');

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-card border-b border-border flex items-center px-4 z-10">
      <AppMenu />
      <span className="text-[18px] font-bold text-card-foreground">{t('headerTitle')}</span>
    </header>
  );
}
