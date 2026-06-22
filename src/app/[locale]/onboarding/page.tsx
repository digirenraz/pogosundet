import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/profile/helpers';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { GettingStartedGuide } from '@/components/onboarding/GettingStartedGuide';

export const preferredRegion = 'dub1';

// "Kom i gang" — the getting-started guide (install the PWA + add friends via
// QR). Reached from the desktop sidebar item and the mobile hamburger menu.
//
// Responsive: DesktopShell frames the guide with the sidebar at lg+ and passes
// it through on mobile, where AppHeader + BottomNav provide the chrome (both
// `lg:hidden`, since the sidebar replaces them on desktop).
export default async function OnboardingPage() {
  const t = await getTranslations('Onboarding');
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) redirect('/login');

  // Own profile drives the sidebar user chip; the middleware guarantees one
  // exists on authenticated routes, so the guide still renders if it's missing.
  const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
  const profile = (data as Profile | null) ?? undefined;

  return (
    <DesktopShell me={profile}>
      <div className="lg:hidden">
        <AppHeader title={t('headerTitle')} />
      </div>

      <GettingStartedGuide />

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </DesktopShell>
  );
}
