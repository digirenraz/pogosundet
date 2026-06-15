import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Pencil, QrCode } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/profile/helpers';
import { Avatar, TeamChip, type AvatarTeam } from '@/components/Avatar';
import { BottomNav } from '@/components/BottomNav';
import { AppHeader } from '@/components/AppHeader';
import { DesktopSidebar } from '@/components/desktop/DesktopSidebar';
import { DesktopProfile } from '@/components/desktop/DesktopProfile';

export const preferredRegion = 'dub1';

// "Min profil" — the logged-in user's own card with edit + QR preview entry points.
// Distinct from /profile/edit; that screen handles editing only.
export default async function ProfileTabPage() {
  const t = await getTranslations('ProfileTab');
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) redirect('/login');

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  // The middleware guarantees a profile exists for authenticated routes; the
  // null-check stays as a safety net.
  if (!data) redirect('/profile/setup');
  const profile = data as Profile;
  const team = (profile.team ?? 'none') as AvatarTeam;

  return (
    <>
    {/* Desktop (≥1024px): sidebar shell + bespoke two-column profile. */}
    <div className="hidden lg:flex h-screen overflow-hidden bg-background">
      <DesktopSidebar me={profile} />
      <div className="flex-1 min-w-0 h-screen overflow-hidden">
        <DesktopProfile profile={profile} />
      </div>
    </div>

    {/* Mobile / tablet (<1024px): the existing single-column profile. */}
    <div className="lg:hidden min-h-screen bg-background flex flex-col">
      {/* Branded header — matches the other mobile tab screens */}
      <AppHeader title={t('headerTitle')} />

      <main className="flex-1 pt-[116px] pb-[80px] px-4 flex flex-col gap-4">
        {/* Identity block */}
        <div className="flex flex-col items-center gap-2.5 py-3">
          <Avatar
            src={profile.avatar_url}
            name={profile.first_name || profile.trainer_name}
            size={104}
            team={team}
            level={profile.level ?? null}
            ringWidth={4}
          />
          <div className="text-[22px] font-extrabold tracking-tight text-foreground">
            {profile.trainer_name}
          </div>
          {profile.first_name && (
            <div className="text-[14px] text-muted-foreground -mt-1">{profile.first_name}</div>
          )}
          <div className="inline-flex gap-1.5 mt-1.5">
            <TeamChip team={team} />
            {profile.level != null && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                style={{ background: '#1b3a52', color: 'var(--color-team-instinct)' }}
              >
                <span
                  className="inline-flex items-center justify-center rounded-full font-extrabold"
                  style={{
                    width: 16,
                    height: 16,
                    background: 'var(--color-team-instinct)',
                    color: '#1b3a52',
                    fontSize: 10,
                  }}
                >
                  {profile.level}
                </span>
                {t('levelChip', { level: profile.level })}
              </span>
            )}
          </div>
        </div>

        {/* Action row */}
        <div className="flex gap-2.5">
          <Link
            href="/profile/edit"
            className="flex-1 h-12 bg-primary text-primary-foreground rounded-md text-[14px] font-bold inline-flex items-center justify-center gap-1.5"
          >
            <Pencil size={14} />
            {t('editButton')}
          </Link>
          <Link
            href={`/players/${profile.id}`}
            className="flex-1 h-12 bg-card text-primary border border-border rounded-md text-[14px] font-bold inline-flex items-center justify-center gap-1.5"
          >
            <QrCode size={14} />
            {t('qrButton')}
          </Link>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="bg-card border border-border rounded-lg p-3.5">
            <div className="text-[11px] tracking-widest font-bold text-muted-foreground uppercase mb-2">
              {t('bioLabel')}
            </div>
            <p className="text-[14px] text-card-foreground leading-relaxed">{profile.bio}</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
    </>
  );
}
