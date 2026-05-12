import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Pencil, QrCode } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/profile/helpers';
import { Avatar, TeamChip, type AvatarTeam } from '@/components/Avatar';
import { BottomNav } from '@/components/BottomNav';

export const preferredRegion = 'dub1';

// "Min profil" — the logged-in user's own card with edit + QR preview entry points.
// Distinct from /profile/edit; that screen handles editing only.
export default async function ProfileTabPage() {
  const t = await getTranslations('ProfileTab');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!data) redirect('/profile/setup');
  const profile = data as Profile;
  const team = (profile.team ?? 'none') as AvatarTeam;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header — matches /players visual chrome */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-card border-b border-border flex items-center px-4 z-10">
        <span className="text-[18px] font-bold text-card-foreground">{t('headerTitle')}</span>
      </header>

      <main className="flex-1 pt-[76px] pb-[80px] px-4 flex flex-col gap-4">
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
  );
}
