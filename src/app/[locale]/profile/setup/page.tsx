'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MapPinned, UserRound, Hash, User, AlignLeft, Camera } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { validateProfile } from '@/lib/profile/validation';
import { createProfile } from '@/lib/profile/helpers';
import { AuthInput } from '@/components/AuthInput';
import { PrimaryButton } from '@/components/PrimaryButton';

export default function ProfileSetupPage() {
  const t = useTranslations('ProfileSetup');
  const router = useRouter();

  const [trainerName, setTrainerName] = useState('');
  const [friendCode, setFriendCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [bio, setBio] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  // Auto-format friend code as user types: insert spaces at positions 4 and 9
  function handleFriendCodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    const parts = [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8, 12)].filter(Boolean);
    setFriendCode(parts.join(' '));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError('');

    const validation = validateProfile({ trainer_name: trainerName, friend_code: friendCode, first_name: firstName, bio });
    if (!validation.valid) {
      // Map error keys to translated messages
      const translated: Record<string, string> = {};
      for (const [field, key] of Object.entries(validation.errors)) {
        translated[field] = t(key as Parameters<typeof t>[0]);
      }
      setErrors(translated);
      return;
    }
    setErrors({});
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { error } = await createProfile({
      user_id: user.id,
      trainer_name: trainerName,
      friend_code: friendCode,
      first_name: firstName || undefined,
      bio: bio || undefined,
    });

    setLoading(false);
    if (error) {
      setGeneralError(t('errorGeneric'));
      return;
    }

    router.push('/');
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

      {/* Scrollable content */}
      <div className="flex-1 px-5 pt-4 pb-6 flex flex-col gap-5">
        {/* Profile card */}
        <div className="bg-card rounded-lg p-5 flex flex-col gap-4">
          <h1 className="text-[22px] font-bold text-card-foreground leading-tight">{t('cardTitle')}</h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{t('cardSubtitle')}</p>

          {/* Photo row */}
          <div className="flex items-center gap-4 p-4 bg-secondary rounded-lg">
            <div className="w-[68px] h-[68px] rounded-full bg-card flex items-center justify-center flex-shrink-0">
              <Camera size={30} className="text-muted-foreground" />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <span className="text-[15px] font-bold text-foreground">{t('photoTitle')}</span>
              <span className="text-[14px] leading-snug text-muted-foreground">{t('photoSubtitle')}</span>
              <button
                type="button"
                className="self-start bg-card text-primary rounded-md px-3 py-2.5 text-[14px] font-semibold"
              >
                {t('photoButton')}
              </button>
            </div>
          </div>

          {/* Form */}
          <form id="profile-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
            <AuthInput
              icon={UserRound}
              label={t('trainerNameLabel')}
              type="text"
              placeholder={t('trainerNamePlaceholder')}
              value={trainerName}
              onChange={(e) => setTrainerName(e.target.value)}
              error={errors.trainer_name}
              autoComplete="off"
            />

            <AuthInput
              icon={Hash}
              label={t('friendCodeLabel')}
              type="text"
              inputMode="numeric"
              placeholder={t('friendCodePlaceholder')}
              value={friendCode}
              onChange={(e) => handleFriendCodeChange(e.target.value)}
              error={errors.friend_code}
              autoComplete="off"
            />

            {/* First name — optional */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[14px] font-semibold text-foreground">{t('firstNameLabel')}</label>
                <span className="px-2 py-1 rounded-[24px] bg-secondary text-secondary-foreground text-[12px] font-semibold">
                  {t('optional')}
                </span>
              </div>
              <div className={`min-h-[52px] bg-input rounded-md px-4 flex items-center gap-3 ${errors.first_name ? 'border border-destructive' : ''}`}>
                <User size={18} className="text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  placeholder={t('firstNamePlaceholder')}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground outline-none"
                  autoComplete="given-name"
                />
              </div>
              {errors.first_name && (
                <p className="text-[13px] text-destructive">{errors.first_name}</p>
              )}
            </div>

            {/* Bio — optional, textarea */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[14px] font-semibold text-foreground">{t('bioLabel')}</label>
                <span className="px-2 py-1 rounded-[24px] bg-secondary text-secondary-foreground text-[12px] font-semibold">
                  {t('optional')}
                </span>
              </div>
              <div className={`bg-input rounded-md px-4 py-3 flex gap-3 ${errors.bio ? 'border border-destructive' : ''}`}>
                <AlignLeft size={18} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                <textarea
                  placeholder={t('bioPlaceholder')}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  maxLength={280}
                  className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed"
                />
              </div>
              <div className="flex justify-between items-center">
                {errors.bio ? (
                  <p className="text-[13px] text-destructive">{errors.bio}</p>
                ) : (
                  <span />
                )}
                <span className="text-[12px] text-muted-foreground ml-auto">{bio.length}/280</span>
              </div>
            </div>
          </form>
        </div>

        {/* General error */}
        {generalError && (
          <p className="text-[14px] text-destructive text-center">{generalError}</p>
        )}

        {/* Footer actions */}
        <div className="flex flex-col gap-3 mt-auto">
          <PrimaryButton type="submit" form="profile-form" disabled={loading}>
            {loading ? '…' : t('submit')}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => router.back()}
            className="h-12 rounded-md bg-secondary text-secondary-foreground text-[15px] font-semibold"
          >
            {t('back')}
          </button>
        </div>
      </div>
    </div>
  );
}
