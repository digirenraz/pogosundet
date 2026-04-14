'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SlidersHorizontal, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Fixed top header for the Player Directory.
// The green icon opens a small dropdown — logout lives there.
// Filter functionality will be added to the same menu in a future slice.
export function DirectoryHeader() {
  const t = useTranslations('PlayerDirectory');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-card border-b border-border flex items-center justify-between px-4 z-10">
      <span className="text-[18px] font-bold text-card-foreground">{t('headerTitle')}</span>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center"
        >
          <SlidersHorizontal size={20} className="text-secondary-foreground" />
        </button>

        {open && (
          <div className="absolute right-0 top-11 bg-card border border-border rounded-lg shadow-md min-w-[140px] py-1 z-20">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-[14px] font-medium text-foreground hover:bg-muted"
            >
              <LogOut size={16} className="text-muted-foreground" />
              {t('logoutButton')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
