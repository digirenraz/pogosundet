import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getRecentRaids } from '@/lib/raids/server-helpers';
import { RaidList } from '@/components/RaidList';
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

  // Raid list, push subscription status, and translations are all independent
  // once we have userId — run them in parallel. The profile-existence guard is
  // enforced by the middleware.
  const [{ active, expired }, { data: pushSub }, t, { data: me }] = await Promise.all([
    getRecentRaids(),
    supabase.from('push_subscriptions').select('id').eq('user_id', userId).maybeSingle(),
    getTranslations('Raids'),
    supabase
      .from('profiles')
      .select('trainer_name, first_name, avatar_url, team, level')
      .eq('user_id', userId)
      .single(),
  ]);

  const hasAny = active.length > 0 || expired.length > 0;
  const pushStatus = pushSub ? 'subscribed' : 'unsubscribed';

  return (
    <DesktopShell me={(me as SidebarUser | null) ?? undefined}>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-card border-b border-border px-4 h-[60px] flex items-center justify-between">
        <h1 className="text-[18px] font-bold text-card-foreground">{t('headerTitle')}</h1>
        <Link
          href="/raids/new"
          className="bg-primary text-primary-foreground rounded-full w-9 h-9 flex items-center justify-center"
          aria-label={t('postButton')}
        >
          <Plus size={20} />
        </Link>
      </div>

      {/* Content padded for fixed header (60px) and fixed bottom nav (64px) */}
      <main className="pt-[76px] pb-[80px] px-4 flex flex-col gap-4">
        <PushSubscribePrompt userId={userId} initialStatus={pushStatus} />
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
