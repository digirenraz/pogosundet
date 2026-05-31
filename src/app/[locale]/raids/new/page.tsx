'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Camera, Minus, Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createRaid, joinRaid, updateAttendeeExtra } from '@/lib/raids/helpers';
import { track } from '@/lib/analytics/amplitude';
import { validateRaid } from '@/lib/raids/validation';
import { BossSearch } from '@/components/BossSearch';
import { GymSearch } from '@/components/GymSearch';

// Start time options relative to now
function getStartTimes() {
  const now = new Date();
  const plus5 = new Date(now.getTime() + 5 * 60 * 1000);
  const plus10 = new Date(now.getTime() + 10 * 60 * 1000);
  const plus15 = new Date(now.getTime() + 15 * 60 * 1000);
  return { now, plus5, plus10, plus15 };
}

// Format file size for display
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NewRaidPage() {
  const t = useTranslations('Raids');
  const router = useRouter();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [gymName, setGymName] = useState('');
  const [bossName, setBossName] = useState('');
  const [startsAtOption, setStartsAtOption] = useState<'now' | '+5' | '+10' | '+15' | null>(null);
  const [note, setNote] = useState('');
  const [extra, setExtra] = useState(0); // how many extra people the poster is bringing
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Web Share Target (Android): when a screenshot is shared into the app, the
  // service worker stashes it in the `pogosundet-share` cache and redirects here.
  // Read it back once on mount, pre-fill the image, then consume it. Cache name +
  // key must match public/sw.js (SHARE_CACHE / SHARE_IMAGE_KEY). No-op on iOS /
  // normal visits (cache miss). Runs client-side only.
  useEffect(() => {
    let cancelled = false;
    async function loadSharedImage() {
      if (!('caches' in window)) return;
      try {
        const cache = await caches.open('pogosundet-share');
        const res = await cache.match('/__shared-raid-image');
        if (!res) return;
        const blob = await res.blob();
        if (cancelled) return;
        const filename = res.headers.get('x-share-filename') || 'screenshot.jpg';
        const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        await cache.delete('/__shared-raid-image');
      } catch {
        // Ignore — the user can still attach a screenshot manually.
      }
    }
    loadSharedImage();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function getStartsAt(): string | null {
    if (startsAtOption === null) return null;
    if (startsAtOption === 'now') return new Date().toISOString();
    const times = getStartTimes();
    if (startsAtOption === '+5') return times.plus5.toISOString();
    if (startsAtOption === '+10') return times.plus10.toISOString();
    return times.plus15.toISOString();
  }

  function handleExtraChange(delta: number) {
    setExtra(prev => Math.max(0, Math.min(9, prev + delta)));
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
      const { data: claimsData } = await supabase.auth.getClaims();
      const userId = claimsData?.claims?.sub;
      if (!userId) {
        router.push('/login');
        return;
      }

      let imageUrl: string | null = null;

      if (imageFile) {
        const ext = imageFile.name.split('.').pop() ?? 'jpg';
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('raid-images')
          .upload(path, imageFile);

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          setError(t('form.errorGeneric'));
          setLoading(false);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('raid-images').getPublicUrl(path);
        imageUrl = publicUrl;
      }

      const { data: newRaid, error: insertError } = await createRaid({
        user_id: userId,
        image_url: imageUrl,
        gym_name: gymName.trim() || null,
        boss_name: bossName || null,
        starts_at: getStartsAt(),
        note: note.trim() || null,
      });

      if (insertError || !newRaid) {
        console.error('Raid insert error:', insertError);
        setError(t('form.errorGeneric'));
        return;
      }

      // Analytics: raid posted. Flags only — no gym/boss name or any PII.
      track('raid_created', {
        has_image: imageUrl !== null,
        has_gym: Boolean(gymName.trim()),
        has_boss: Boolean(bossName),
      });

      // Auto-join the poster and set their extra count
      await joinRaid(newRaid.id, userId);
      if (extra > 0) {
        await updateAttendeeExtra(newRaid.id, userId, extra);
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

  // Player count display
  const totalTrainers = 1 + extra;
  const playerLabel =
    extra === 0
      ? t('form.justMe')
      : t('form.withExtra', { count: extra });
  const totalLabel = t('form.totalTrainers', { count: totalTrainers });

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

            {imagePreview && imageFile ? (
              /* Image selected: horizontal thumbnail card */
              <div className="border border-border rounded-xl overflow-hidden flex">
                {/* Thumbnail */}
                <div className="relative w-[108px] shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Raid screenshot"
                    className="w-full h-full object-cover"
                    style={{ minHeight: 72 }}
                  />
                </div>
                {/* File info + remove */}
                <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                  <p className="text-[13px] font-semibold text-card-foreground truncate">
                    {imageFile.name}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {formatFileSize(imageFile.size)}
                  </p>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="mt-1.5 flex items-center gap-1 text-[12px] text-muted-foreground hover:text-destructive transition-colors w-fit"
                  >
                    <X size={13} />
                    Fjern
                  </button>
                </div>
              </div>
            ) : (
              /* No image: dashed upload button */
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-xl h-20 flex items-center justify-center gap-3 text-muted-foreground"
              >
                <Camera size={22} />
                <span className="text-[14px]">{t('form.imageHint')}</span>
                <span className="bg-secondary text-primary text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {t('form.imageRecommended')}
                </span>
              </button>
            )}
          </div>

          {/* Gym field — GymSearch autocomplete */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-[14px] font-semibold text-card-foreground">
                {t('form.gymLabel')}
              </label>
              <span className="text-[12px] text-muted-foreground">{t('form.optional')}</span>
            </div>
            <GymSearch
              value={gymName}
              onChange={setGymName}
              placeholder={t('form.gymSearch')}
            />
          </div>

          {/* Boss field — BossSearch autocomplete */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-[14px] font-semibold text-card-foreground">
                {t('form.bossLabel')}
              </label>
              <span className="text-[12px] text-muted-foreground">{t('form.optional')}</span>
            </div>
            <BossSearch
              value={bossName}
              onChange={setBossName}
              placeholder={t('form.bossSearch')}
            />
          </div>

          {/* Start time — quick picks */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-[14px] font-semibold text-card-foreground">
                {t('form.startsAtLabel')}
              </label>
              <span className="text-[12px] text-muted-foreground">{t('form.optional')}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {startOptions.map(({ key, label }) => {
                const selected = startsAtOption === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setStartsAtOption(selected ? null : key)}
                    className={`py-2 rounded-lg text-[13px] font-semibold border transition-colors ${
                      selected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-card-foreground border-border'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note — optional */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-[14px] font-semibold text-card-foreground">
                {t('form.noteLabel')}
              </label>
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

          {/* Player count stepper */}
          <div className="bg-input rounded-xl p-3">
            <p className="text-[13px] font-semibold text-muted-foreground mb-2">
              {t('form.playerCountLabel')}
            </p>
            <div className="flex items-center justify-between">
              {/* Minus */}
              <button
                type="button"
                disabled={extra === 0}
                onClick={() => handleExtraChange(-1)}
                className="w-9 h-9 rounded-lg border border-border bg-background flex items-center justify-center text-card-foreground disabled:opacity-40"
                aria-label="Færre"
              >
                <Minus size={16} />
              </button>

              {/* Center display */}
              <div className="flex flex-col items-center">
                <p className="text-[17px] font-extrabold text-primary">{playerLabel}</p>
                <p className="text-[12px] text-muted-foreground">{totalLabel}</p>
              </div>

              {/* Plus */}
              <button
                type="button"
                disabled={extra === 9}
                onClick={() => handleExtraChange(1)}
                className="w-9 h-9 rounded-lg border border-primary bg-secondary flex items-center justify-center text-primary disabled:opacity-40"
                aria-label="Flere"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {error && <p className="text-destructive text-[14px]">{error}</p>}

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
