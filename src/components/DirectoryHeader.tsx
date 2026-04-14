import { SlidersHorizontal } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

// Fixed top header for the Player Directory.
// The filter button is visual-only for now — filter functionality comes in a future slice.
export async function DirectoryHeader() {
  const t = await getTranslations('PlayerDirectory');

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-card border-b border-border flex items-center justify-between px-4 z-10">
      <span className="text-[18px] font-bold text-card-foreground">{t('headerTitle')}</span>
      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
        <SlidersHorizontal size={20} className="text-secondary-foreground" />
      </div>
    </header>
  );
}
