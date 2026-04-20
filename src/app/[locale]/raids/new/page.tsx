'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Camera } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createRaid } from '@/lib/raids/helpers';
import { validateRaid } from '@/lib/raids/validation';
import { RAID_BOSSES } from '@/lib/raids/bosses';

// Start time options relative to now
function getStartTimes() {
  const now = new Date();
  const plus5 = new Date(now.getTime() + 5 * 60 * 1000);
  const plus10 = new Date(now.getTime() + 10 * 60 * 1000);
  const plus15 = new Date(now.getTime() + 15 * 60 * 1000);
  return { now, plus5, plus10, plus15 };
}

export default function NewRaidPage() {
  const t = useTranslations('Raids');
  const router = useRouter();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [gymName, setGymName] = useState('');
  const [bossName, setBossName] = useState('');
  const [startsAtOption, setStartsAtOption] = useState<'now' | '+5' | '+10' | '+15'>('now');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function getStartsAt(): string | null {
    if (startsAtOption === 'now') return new Date().toISOString();
    const times = getStartTimes();
    if (startsAtOption === '+5') return times.plus5.toISOString();
    if (startsAtOption === '+10') return times.plus10.toISOString();
    return times.plus15.toISOString();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = validateRaid({
      image_url: imageFile ? 'pending' : null,
      gym_name: gymName || null,
      boss_name: bossName || null,
    });

    if (!validation.valid) {
      setError(t('form.errorAtLeastOne'));
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      let imageUrl: string | null = null;

      if (imageFile) {
        const ext = imageFile.name.split('.').pop() ?? 'jpg';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('raid-images')
          .upload(path, imageFile);

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          setError(t('form.errorGeneric'));
          setLoading(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('raid-images')
          .getPublicUrl(path);
        imageUrl = publicUrl;
      }

      const { error: insertError } = await createRaid({
        user_id: user.id,
        image_url: imageUrl,
        gym_name: gymName.trim() || null,
        boss_name: bossName || null,
        starts_at: getStartsAt(),
        note: note.trim() || null,
      });

      if (insertError) {
        console.error('Raid insert error:', insertError);
        setError(t('form.errorGeneric'));
        return;
      }

      router.push('/raids');
    } catch {
      setError(t('form.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }

  const startOptions: Array<{ key: typeof startsAtOption; label: string }> = [
    { key: 'now', label: t('form.now') },
    { key: '+5', label: t('form.plus5') },
    { key: '+10', label: t('form.plus10') },
    { key: '+15', label: t('form.plus15') },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-card border-b border-border px-4 h-[60px] flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground"
          aria-label={t('form.back')}
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-[18px] font-bold text-card-foreground">{t('form.title')}</h1>
      </div>

      <main className="pt-[76px] pb-8 px-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Image upload — primary input */}
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-semibold text-card-foreground">
              {t('form.imageLabel')}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Raid screenshot" className="w-full object-cover max-h-64" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-black/60 text-white text-[12px] rounded-md px-3 py-1.5"
                >
                  {t('form.imageChange')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg h-36 flex flex-col items-center justify-center gap-2 text-muted-foreground"
              >
                <Camera size={28} />
                <span className="text-[14px]">{t('form.imageButton')}</span>
              </button>
            )}
          </div>

          {/* Gym name — optional */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-[14px] font-semibold text-card-foreground">{t('form.gymLabel')}</label>
              <span className="text-[12px] text-muted-foreground">{t('form.optional')}</span>
            </div>
            <input
              type="text"
              value={gymName}
              onChange={e => setGymName(e.target.value)}
              placeholder={t('form.gymPlaceholder')}
              className="border border-border rounded-lg px-3 py-2.5 text-[15px] bg-background text-card-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Boss — optional */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-[14px] font-semibold text-card-foreground">{t('form.bossLabel')}</label>
              <span className="text-[12px] text-muted-foreground">{t('form.optional')}</span>
            </div>
            <select
              value={bossName}
              onChange={e => setBossName(e.target.value)}
              className="border border-border rounded-lg px-3 py-2.5 text-[15px] bg-background text-card-foreground outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('form.bossPlaceholder')}</option>
              {RAID_BOSSES.map(boss => (
                <option key={boss} value={boss}>{boss}</option>
              ))}
            </select>
          </div>

          {/* Start time — quick picks */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-[14px] font-semibold text-card-foreground">{t('form.startsAtLabel')}</label>
              <span className="text-[12px] text-muted-foreground">{t('form.optional')}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {startOptions.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStartsAtOption(key)}
                  className={`py-2 rounded-lg text-[13px] font-semibold border transition-colors ${
                    startsAtOption === key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-card-foreground border-border'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Note — optional */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-[14px] font-semibold text-card-foreground">{t('form.noteLabel')}</label>
              <span className="text-[12px] text-muted-foreground">{t('form.optional')}</span>
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('form.notePlaceholder')}
              rows={3}
              className="border border-border rounded-lg px-3 py-2.5 text-[15px] bg-background text-card-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {error && (
            <p className="text-destructive text-[14px]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-primary-foreground rounded-lg py-3 text-[16px] font-bold disabled:opacity-60"
          >
            {loading ? '…' : t('form.submit')}
          </button>
        </form>
      </main>
    </div>
  );
}
