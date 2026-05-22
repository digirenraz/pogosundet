'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MapPinned } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createProfile } from '@/lib/profile/helpers';
import type { ProfileInput } from '@/lib/profile/validation';
import { ProfileForm } from '@/components/ProfileForm';

export default function ProfileSetupPage() {
  const t = useTranslations('ProfileSetup');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [userId, setUserId] = useState('');

  // Resolve the user ID once on mount so we can pass it to ProfileForm
  // (needed for avatar uploads before the form is submitted).
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getClaims().then(({ data }) => {
      const uid = data?.claims?.sub;
      if (uid) setUserId(uid);
    });
  }, []);

  async function handleSubmit(input: ProfileInput) {
    setLoading(true);
    setGeneralError('');

    const supabase = createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const uid = claimsData?.claims?.sub;
    if (!uid) { router.push('/login'); return; }
    // Keep userId state in sync (handles edge case where mount effect hasn't resolved yet)
    if (!userId) setUserId(uid);

    const { error } = await createProfile({ user_id: uid, ...input });
    setLoading(false);

    if (error) {
      setGeneralError(t('errorGeneric'));
      return;
    }
    // Send iOS users to the PWA install onboarding; non-iOS go straight to the directory
    const dest = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '/onboarding/ios' : '/players';
    router.push(dest);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="px-5 pt-6 pb-2 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[14px] bg-primary flex items-center justify-center flex-shrink-0">
            <MapPinned size={24} className="text-primary-foreground" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xl font-bold text-foreground whitespace-nowrap">PoGoSundet</span>
            <span className="text-sm text-muted-foreground">{t('subtitle')}</span>
          </div>
        </div>
        <span className="self-start px-2.5 py-1.5 rounded-[24px] bg-secondary text-secondary-foreground text-[13px] font-semibold">
          {t('stepChip')}
        </span>
      </div>

      <div className="flex-1 px-5 pt-4 pb-6">
        <div className="bg-card rounded-lg p-5 flex flex-col gap-4">
          <h1 className="text-[22px] font-bold text-card-foreground leading-tight">{t('cardTitle')}</h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{t('cardSubtitle')}</p>

          <ProfileForm
            t={(key) => t(key as Parameters<typeof t>[0])}
            currentUserId={userId}
            onSubmit={handleSubmit}
            submitLabel={t('submit')}
            loading={loading}
            generalError={generalError}
            onBack={() => router.back()}
            backLabel={t('back')}
          />
        </div>
      </div>
    </div>
  );
}
