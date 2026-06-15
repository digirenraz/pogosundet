import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getRecentRaids } from '@/lib/raids/server-helpers';
import { RaidList } from '@/components/RaidList';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { PushSubscribePrompt } from '@/components/PushSubscribePrompt';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import type { SidebarUser } from '@/components/desktop/DesktopSidebar';

// Raids page — shows active raids (and recently expired ones) plus a button to post a new one.
export default async function RaidsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) redirect('/login');

  // Raid list, translations, and the viewer's profile are independent once we
  // have userId — run them in parallel. The profile-existence guard is enforced
  // by the middleware. Push-subscription state is intentionally NOT read here:
  // the `PushSubscribePrompt` checks the live browser subscription on the
  // device, since the DB row survives a PWA uninstall and would otherwise
  // suppress the prompt after a reinstall (see the component).
  const [{ active, expired }, t, { data: me }] = await Promise.all([
    getRecentRaids(userId),
    getTranslations('Raids'),
    supabase
      .from('profiles')
      .select('trainer_name, first_name, avatar_url, team, level')
      .eq('user_id', userId)
      .single(),
  ]);

  const hasAny = active.length > 0 || expired.length > 0;

  return (
    <DesktopShell me={(me as SidebarUser | null) ?? undefined}>
    <div className="min-h-screen bg-background">
      {/* Mobile: branded header (icon + wordmark + large title) with the "+" action. */}
      <div className="lg:hidden">
        <AppHeader
          title={t('headerTitle')}
          action={
            <Link
              href="/raids/new"
              className="bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center shadow-[0_3px_8px_rgba(0,176,159,0.30)]"
              aria-label={t('postButton')}
            >
              <Plus size={22} />
            </Link>
          }
        />
      </div>

      {/* Desktop: the sidebar (DesktopShell) brands the screen, so keep the simple
          single-row header here — title + create action. */}
      <div className="hidden lg:flex fixed top-0 left-0 right-0 z-10 bg-card border-b border-border px-4 h-[60px] items-center justify-between">
        <h1 className="text-[18px] font-bold text-card-foreground">{t('headerTitle')}</h1>
        <Link
          href="/raids/new"
          className="bg-primary text-primary-foreground rounded-full w-9 h-9 flex items-center justify-center"
          aria-label={t('postButton')}
        >
          <Plus size={20} />
        </Link>
      </div>

      {/* Content padded for the branded header (~105px mobile / 60px desktop) + bottom nav (64px) */}
      <main className="pt-[116px] lg:pt-[76px] pb-[80px] px-4 flex flex-col gap-4">
        <PushSubscribePrompt userId={userId} />
        {!hasAny ? (
          <p className="text-center text-muted-foreground text-[14px] mt-8">{t('emptyState')}</p>
        ) : (
          <RaidList active={active} expired={expired} currentUserId={userId} />
        )}
      </main>

      <BottomNav />
    </div>
    </DesktopShell>
  );
}
