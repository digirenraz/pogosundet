'use client';

import { useTranslations } from 'next-intl';
import { AppHeader } from '@/components/AppHeader';

// Fixed top header for the Player Directory — the branded variant (app icon +
// "PoGoSundet" wordmark + large screen title). Logout used to live in a dropdown
// here; it now lives on the edit-profile page. The hamburger (inside AppHeader →
// AppMenu) opens the changelog. No lg:hidden wrapper needed — the whole mobile
// directory is already lg:hidden.
export function DirectoryHeader() {
  const t = useTranslations('PlayerDirectory');

  return <AppHeader title={t('headerTitle')} />;
}
