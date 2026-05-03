import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getRecentRaids } from '@/lib/raids/server-helpers';
import { RaidList } from '@/components/RaidList';
import { BottomNav } from '@/components/BottomNav';
import { PushSubscribePrompt } from '@/components/PushSubscribePrompt';

// Raids page — shows active raids (and recently expired ones) plus a button to post a new one.
export default async function RaidsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: ownProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!ownProfile) redirect('/profile/setup');

  const { active, expired } = await getRecentRaids();
  const t = await getTranslations('Raids');

  const hasAny = active.length > 0 || expired.length > 0;

  // Check if the current user already has a push subscription stored
  const { data: pushSub } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  const pushStatus = pushSub ? 'subscribed' : 'unsubscribed';

  return (
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
        <PushSubscribePrompt userId={user.id} initialStatus={pushStatus} />
        {!hasAny ? (
          <p className="text-center text-muted-foreground text-[14px] mt-8">{t('emptyState')}</p>
        ) : (
          <RaidList active={active} expired={expired} currentUserId={user.id} />
        )}
      </main>

      <BottomNav />
    </div>
  );
}
