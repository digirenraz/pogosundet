'use client';

import { useState } from 'react';
import { UserRound, Hash, User, AlignLeft, Camera } from 'lucide-react';
import { validateProfile, type ProfileInput, type Team } from '@/lib/profile/validation';
import { AuthInput } from '@/components/AuthInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TEAMS } from '@/components/Avatar';

interface ProfileFormProps {
  // Translation function scoped to the caller's namespace (ProfileSetup or ProfileEdit)
  t: (key: string) => string;
  initialValues?: Partial<ProfileInput>;
  onSubmit: (input: ProfileInput) => Promise<void>;
  submitLabel: string;
  loading: boolean;
  generalError: string;
  onBack?: () => void;
  backLabel?: string;
}

const TEAM_KEYS: Team[] = ['mystic', 'valor', 'instinct'];

// Shared form for both profile creation (/profile/setup) and editing (/profile/edit).
// The caller owns submission logic and error state; this component handles fields + validation.
export function ProfileForm({
  t,
  initialValues,
  onSubmit,
  submitLabel,
  loading,
  generalError,
  onBack,
  backLabel,
}: ProfileFormProps) {
  const [trainerName, setTrainerName] = useState(initialValues?.trainer_name ?? '');
  const [friendCode, setFriendCode] = useState(initialValues?.friend_code ?? '');
  const [firstName, setFirstName] = useState(initialValues?.first_name ?? '');
  const [bio, setBio] = useState(initialValues?.bio ?? '');
  const [team, setTeam] = useState<Team | null>(initialValues?.team ?? null);
  const [level, setLevel] = useState<number>(initialValues?.level ?? 40);
  const [levelSet, setLevelSet] = useState<boolean>(initialValues?.level != null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleFriendCodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    const parts = [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8, 12)].filter(Boolean);
    setFriendCode(parts.join(' '));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validation = validateProfile({
      trainer_name: trainerName,
      friend_code: friendCode,
      first_name: firstName,
      bio,
      team: team ?? undefined,
      level: levelSet ? level : undefined,
    });
    if (!validation.valid) {
      const translated: Record<string, string> = {};
      for (const [field, key] of Object.entries(validation.errors)) {
        translated[field] = t(key);
      }
      setErrors(translated);
      return;
    }
    setErrors({});
    await onSubmit({
      trainer_name: trainerName,
      friend_code: friendCode,
      first_name: firstName || undefined,
      bio: bio || undefined,
      team: team ?? undefined,
      level: levelSet ? level : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Photo row */}
      <div className="flex items-center gap-4 p-4 bg-secondary rounded-lg">
        <div className="w-[68px] h-[68px] rounded-full bg-card flex items-center justify-center flex-shrink-0">
          <Camera size={30} className="text-muted-foreground" />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-[15px] font-bold text-foreground">{t('photoTitle')}</span>
          <span className="text-[14px] leading-snug text-muted-foreground">{t('photoSubtitle')}</span>
          <button type="button" className="self-start bg-card text-primary rounded-md px-3 py-2.5 text-[14px] font-semibold">
            {t('photoButton')}
          </button>
        </div>
      </div>

      {/* Form fields */}
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

        {/* Team picker — optional */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[14px] font-semibold text-foreground">{t('teamLabel')}</label>
            <span className="px-2 py-1 rounded-[24px] bg-secondary text-secondary-foreground text-[12px] font-semibold">
              {t('optional')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TEAM_KEYS.map((k) => {
              const meta = TEAMS[k];
              const active = team === k;
              return (
                <button
                  type="button"
                  key={k}
                  onClick={() => setTeam(active ? null : k)}
                  className="rounded-md px-1 py-2.5 flex flex-col items-center gap-1"
                  style={{
                    background: active
                      ? `color-mix(in srgb, ${meta.color} 8%, transparent)`
                      : 'var(--color-card)',
                    border: `1.5px solid ${active ? meta.color : 'var(--color-border)'}`,
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center rounded-full text-white font-extrabold"
                    style={{ width: 36, height: 36, background: meta.color, fontSize: 16 }}
                  >
                    {meta.short}
                  </span>
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: active ? meta.color : 'var(--color-foreground)' }}
                  >
                    {t(`team${meta.label}` as 'teamMystic' | 'teamValor' | 'teamInstinct')}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setTeam(null)}
            className="self-start text-[12px] font-semibold"
            style={{
              color: team === null ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
              textDecoration: team === null ? 'underline' : 'none',
            }}
          >
            {t('teamClearLabel')}
          </button>
          {errors.team && <p className="text-[13px] text-destructive">{errors.team}</p>}
        </div>

        {/* Level — optional number input */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[14px] font-semibold text-foreground">
              {t('levelLabel')}
            </label>
            <span className="px-2 py-1 rounded-[24px] bg-secondary text-secondary-foreground text-[12px] font-semibold">
              {t('optional')}
            </span>
          </div>
          <input
            type="number"
            min={1}
            max={80}
            inputMode="numeric"
            value={levelSet ? level : ''}
            placeholder="1–80"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                setLevelSet(false);
              } else {
                const n = Number(raw);
                if (!Number.isNaN(n)) {
                  setLevel(n);
                  setLevelSet(true);
                }
              }
            }}
            className="bg-input border border-border rounded-lg px-3.5 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground w-full outline-none focus:border-primary"
            aria-label={t('levelLabel')}
          />
          {errors.level && <p className="text-[13px] text-destructive">{errors.level}</p>}
        </div>

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
          {errors.first_name && <p className="text-[13px] text-destructive">{errors.first_name}</p>}
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
            {errors.bio ? <p className="text-[13px] text-destructive">{errors.bio}</p> : <span />}
            <span className="text-[12px] text-muted-foreground ml-auto">{bio.length}/280</span>
          </div>
        </div>
      </form>

      {/* General error */}
      {generalError && <p className="text-[14px] text-destructive text-center">{generalError}</p>}

      {/* Footer actions */}
      <div className="flex flex-col gap-3 mt-auto pt-2">
        <PrimaryButton type="submit" form="profile-form" disabled={loading}>
          {loading ? '…' : submitLabel}
        </PrimaryButton>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="h-12 rounded-md bg-secondary text-secondary-foreground text-[15px] font-semibold"
          >
            {backLabel}
          </button>
        )}
      </div>
    </div>
  );
}
