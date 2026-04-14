'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getProfile, updateProfile } from '@/lib/profile/helpers';
import type { ProfileInput } from '@/lib/profile/validation';
import { ProfileForm } from '@/components/ProfileForm';
import { BottomNav } from '@/components/BottomNav';

export default function ProfileEditPage() {
  const t = useTranslations('ProfileSetup'); // reuse ProfileSetup keys for form labels
  const tEdit = useTranslations('ProfileEdit');
  const router = useRouter();

  const [initialValues, setInitialValues] = useState<Partial<ProfileInput> | undefined>();
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Load current profile on mount
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);
      const { data } = await getProfile(user.id);
      if (data) {
        setInitialValues({
          trainer_name: data.trainer_name,
          friend_code: data.friend_code,
          first_name: data.first_name ?? '',
          bio: data.bio ?? '',
        });
      }
    }
    load();
  }, [router]);

  async function handleSubmit(input: ProfileInput) {
    setLoading(true);
    setGeneralError('');
    setSuccessMessage('');
    const { error } = await updateProfile(userId, input);
    setLoading(false);
    if (error) {
      setGeneralError(tEdit('errorGeneric'));
      return;
    }
    setSuccessMessage(tEdit('successMessage'));
    // Return to directory after a brief moment so user sees the success message
    setTimeout(() => router.push('/players'), 1200);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-border bg-card">
        <button onClick={() => router.push('/players')} className="text-muted-foreground">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-[18px] font-bold text-card-foreground">{tEdit('headerTitle')}</h1>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 pt-4 pb-[96px]">
        {successMessage && (
          <p className="text-[14px] text-success font-semibold text-center mb-4">{successMessage}</p>
        )}
        {initialValues !== undefined ? (
          <ProfileForm
            t={(key) => t(key as Parameters<typeof t>[0])}
            initialValues={initialValues}
            onSubmit={handleSubmit}
            submitLabel={tEdit('submit')}
            loading={loading}
            generalError={generalError}
          />
        ) : (
          <p className="text-center text-muted-foreground py-12">…</p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
