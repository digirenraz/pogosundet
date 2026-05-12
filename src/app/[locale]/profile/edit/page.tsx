'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Trash2 } from 'lucide-react';
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

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
          team: data.team ?? undefined,
          level: data.level ?? undefined,
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
    // Return to the "Min profil" view so the user can verify the changes
    setTimeout(() => router.push('/profile'), 1200);
  }

  async function handleDeleteConfirm() {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) throw new Error('delete failed');
      // Sign out locally (server already deleted the auth user)
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/');
      router.refresh();
    } catch {
      setDeleteLoading(false);
      setDeleteError(tEdit('deleteErrorGeneric'));
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-[#E5E7EB] bg-white">
        <button onClick={() => router.push('/profile')} className="text-[#6B7280]">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-[18px] font-bold text-[#111827]">{tEdit('headerTitle')}</h1>
      </div>

      {/* Form */}
      <div className="flex-1 px-4 pt-4 pb-[96px]">
        {successMessage && (
          <p className="text-[14px] text-[#2BBFAA] font-semibold text-center mb-4">{successMessage}</p>
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
          <p className="text-center text-[#9CA3AF] py-12">…</p>
        )}

        {/* Delete account section */}
        <div className="mt-8 border-t border-[#E5E7EB] pt-6">
          <p className="text-sm font-semibold text-[#111827] mb-1">{tEdit('deleteSection')}</p>
          <p className="text-xs text-[#6B7280] mb-4 leading-relaxed">{tEdit('deleteWarning')}</p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full bg-red-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              {tEdit('deleteButton')}
            </button>
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-[#111827]">{tEdit('deleteConfirmTitle')}</p>
              <p className="text-xs text-[#6B7280] leading-relaxed">{tEdit('deleteConfirmBody')}</p>
              {deleteError && (
                <p className="text-xs text-red-500">{deleteError}</p>
              )}
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="w-full bg-red-500 text-white font-semibold py-3 px-4 rounded-xl disabled:opacity-60"
              >
                {deleteLoading ? '…' : tEdit('deleteConfirmYes')}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
                disabled={deleteLoading}
                className="w-full text-[#2BBFAA] font-semibold py-3 px-4 rounded-xl"
              >
                {tEdit('deleteConfirmNo')}
              </button>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
