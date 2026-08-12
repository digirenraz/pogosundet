import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getReports, isCurrentUserAdmin } from '@/lib/moderation/server-helpers';
import { ModerationScreen } from '@/components/moderation/ModerationScreen';
import { BottomNav } from '@/components/BottomNav';

export const preferredRegion = 'dub1';

// Reports change constantly and the queue must never be served from a cache —
// a moderator acting on a stale list would be acting on already-handled work.
export const dynamic = 'force-dynamic';

// /admin — the moderation queue. Server Component.
//
// notFound() rather than redirect() for non-moderators: a 404 doesn't confirm
// that the route exists at all, so ordinary users can't discover the surface by
// probing URLs. The RLS policies are the real protection — this is defence in
// depth on top of them.
export default async function AdminPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect('/login');

  if (!(await isCurrentUserAdmin())) notFound();

  const [{ pending, history }, t] = await Promise.all([
    getReports(),
    getTranslations('Moderation'),
  ]);

  return (
    <>
      <ModerationScreen
        pending={pending}
        history={history}
        title={t('title')}
      />
      <BottomNav />
    </>
  );
}
