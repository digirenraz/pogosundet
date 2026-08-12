import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';

export const preferredRegion = 'dub1';

// Ban state changes the moment a moderator acts, so this page must never be
// served from a cache — a lifted ban has to disappear on the next load.
export const dynamic = 'force-dynamic';

// /udelukket — shown to a user whose account has been banned by a moderator.
// The middleware ban guard redirects here from every other authenticated page.
//
// The ban reason is read through get_own_profile(), the SECURITY DEFINER RPC
// from migration 022: `banned_reason` is REVOKEd from the authenticated role
// (migration 023) so a normal select can't read it, but a user is entitled to
// know why their own account was restricted.
export default async function BannedPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect('/login');

  const t = await getTranslations('Banned');

  const { data: rows } = await supabase.rpc('get_own_profile');
  const profile = Array.isArray(rows) ? rows[0] : null;

  // Not (or no longer) banned — nothing to show here, send them back to the app.
  if (!profile?.banned_at) redirect('/players');

  const reason: string | null = profile.banned_reason ?? null;
  const bannedAt = new Date(profile.banned_at);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="w-full max-w-[420px] bg-card border border-border rounded-lg p-6 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <ShieldAlert size={40} className="text-destructive" />
          <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-card-foreground">
            {t('title')}
          </h1>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            {t('body')}
          </p>
        </div>

        {reason && (
          <div className="px-3.5 py-3 bg-input rounded-xl">
            <p className="text-[12px] font-bold text-muted-foreground mb-1">
              {t('reasonLabel')}
            </p>
            <p className="text-[14px] text-card-foreground leading-snug whitespace-pre-wrap break-words">
              {reason}
            </p>
          </div>
        )}

        <p className="text-[13px] text-muted-foreground text-center">
          {t('since', {
            date: bannedAt.toLocaleDateString('da-DK', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
          })}
        </p>

        <p className="text-[13px] text-muted-foreground leading-relaxed text-center">
          {t('appeal')}
        </p>

        <LogoutButton />
      </div>
    </main>
  );
}
