'use client';

import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Stage = 'intro' | 'cropping' | 'done';

interface AvatarUploadSheetProps {
  userId: string;
  onCancel(): void;
  /** Called with the cropped data URL. Parent owns the upload + close logic. */
  onPick(dataUrl: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// FakePoGoScreenshot — structural phone mockup (no real images)
// When `fullImage` is provided, shows the user's picked screenshot underneath.
// ---------------------------------------------------------------------------

function FakePoGoScreenshot({ fullImage }: { fullImage?: string | null }) {
  const bar = (
    top: number,
    left: number,
    right: number,
    opts: { h?: number; bg?: string; op?: number } = {},
  ) => (
    <div
      style={{
        position: 'absolute',
        top: `${top}%`,
        left: `${left}%`,
        right: `${right}%`,
        height: opts.h ?? 3,
        borderRadius: 999,
        background: opts.bg ?? '#1b3a52',
        opacity: opts.op != null ? opts.op : 0.7,
      }}
    />
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg,#eaf8ef 0%,#d6f1de 60%,#c8eed7 100%)',
        overflow: 'hidden',
      }}
    >
      {fullImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fullImage}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {/* status bar dots */}
      <div style={{ position: 'absolute', top: '2%', left: '8%', width: 5, height: 2, borderRadius: 1, background: '#1b3a52', opacity: 0.6 }} />
      <div style={{ position: 'absolute', top: '2%', right: '8%', width: 8, height: 3, borderRadius: 1, background: '#1b3a52', opacity: 0.6 }} />

      {/* tabs */}
      <div style={{ position: 'absolute', top: '7%', left: '18%', width: '20%', height: 2, background: '#1b3a52', opacity: 0.85 }} />
      <div style={{ position: 'absolute', top: '9%', left: '15%', width: '26%', height: 1.5, borderRadius: 1, background: '#1b3a52' }} />
      <div style={{ position: 'absolute', top: '7%', right: '20%', width: '16%', height: 2, background: '#1b3a52', opacity: 0.5 }} />

      {/* avatar circle placeholder */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '28%',
          aspectRatio: '1',
          borderRadius: '9999px',
          background: '#ffe1e1',
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.08)',
        }}
      />

      {/* trainer name + friend code lines */}
      {bar(32, 28, 28, { h: 2, op: 0.5 })}
      {bar(37, 18, 18, { h: 4, op: 0.85 })}

      {/* QR placeholder card */}
      <div
        style={{
          position: 'absolute',
          top: '44%',
          left: '18%',
          right: '18%',
          aspectRatio: '1',
          background: '#fff',
          borderRadius: 3,
          padding: '8%',
          boxSizing: 'border-box',
          border: '0.5px solid rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ width: '100%', height: '100%', background: 'repeating-conic-gradient(#1b3a52 0% 25%, #fff 0% 50%) 50% / 4px 4px' }} />
      </div>

      {/* SHARE CODE pill */}
      <div style={{ position: 'absolute', top: '70%', left: '22%', right: '22%', height: '5%', borderRadius: 999, border: '1px solid #00b09f', background: 'rgba(255,255,255,0.7)' }} />

      {/* ADD FRIEND divider */}
      <div style={{ position: 'absolute', top: '78%', left: '10%', right: '10%', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ flex: 1, height: 1, background: '#1b3a52', opacity: 0.25 }} />
        <span style={{ width: '24%', height: 2, background: '#1b3a52', opacity: 0.55, borderRadius: 1 }} />
        <span style={{ flex: 1, height: 1, background: '#1b3a52', opacity: 0.25 }} />
      </div>

      {/* code input pill */}
      <div style={{ position: 'absolute', top: '85%', left: '12%', right: '12%', height: '4.5%', borderRadius: 999, border: '1px solid #00b09f', background: 'rgba(255,255,255,0.6)' }} />

      {/* OR dot */}
      <div style={{ position: 'absolute', top: '91.5%', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <span style={{ width: '8%', height: 2, background: '#1b3a52', opacity: 0.5, borderRadius: 1 }} />
      </div>

      {/* SCAN CODE pill */}
      <div style={{ position: 'absolute', top: '95%', left: '12%', right: '12%', height: '4.5%', borderRadius: 999, border: '1px solid #00b09f', background: 'rgba(255,255,255,0.6)' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PoGoScreenshotIllustration — 64px-wide phone with green ring marker
// ---------------------------------------------------------------------------

function PoGoScreenshotIllustration() {
  return (
    <div
      style={{
        position: 'relative',
        width: 64,
        aspectRatio: '9/16',
        borderRadius: 8,
        overflow: 'hidden',
        border: '2px solid #1b3a52',
        flexShrink: 0,
      }}
    >
      <FakePoGoScreenshot />
      {/* green ring over the avatar position */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '28%',
          aspectRatio: '1',
          borderRadius: '9999px',
          boxShadow: '0 0 0 2px #00b09f, 0 0 0 5px rgba(0,176,159,0.25)',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Crop logic — extracts the circular avatar region from a PoGo screenshot
// ---------------------------------------------------------------------------

function cropFromImage(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const cw = img.naturalWidth * 0.32;
        const cx = img.naturalWidth / 2 - cw / 2;
        const cy = img.naturalHeight * 0.18;
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d')!;
        ctx.beginPath();
        ctx.arc(100, 100, 100, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, cx, cy, cw, cw, 0, 0, 200, 200);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(url);
      }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// AvatarUploadSheet — the main three-stage bottom sheet
// ---------------------------------------------------------------------------

export function AvatarUploadSheet({ onCancel, onPick }: AvatarUploadSheetProps) {
  const t = useTranslations('ProfileForm');
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('intro');
  const [pickedSrc, setPickedSrc] = useState<string | null>(null);
  const [croppedSrc, setCroppedSrc] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPickedSrc(url);
    setStage('cropping');
    // Run the scan animation for 1600ms, then crop
    setTimeout(async () => {
      const cropped = await cropFromImage(url);
      setCroppedSrc(cropped);
      setStage('done');
    }, 1600);
  }

  async function handleConfirm() {
    if (!croppedSrc) return;
    setPicking(true);
    await onPick(croppedSrc);
    // Parent handles closing the sheet after upload completes
    setPicking(false);
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 bg-black/50 z-30 flex items-end"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Sheet */}
      <div className="bg-white rounded-t-[20px] w-full px-4 pt-3.5 pb-5 max-h-[88%] overflow-y-auto">
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-3.5" />

        {/* ── STAGE: intro ── */}
        {stage === 'intro' && (
          <>
            <p className="text-[20px] font-extrabold tracking-tight">{t('uploadTitle')}</p>
            <p className="mt-1.5 mb-3.5 text-[14px] text-muted-foreground leading-snug">
              {t('uploadSubtitle')}
            </p>

            {/* How-to illustration card */}
            <div className="bg-[#f6fcfb] border border-secondary rounded-2xl p-3.5 flex gap-3.5 items-center mb-3.5">
              <PoGoScreenshotIllustration />
              <div className="flex-1 text-[12px] text-[#1b3a52] leading-relaxed">
                <p className="font-bold mb-1">{t('uploadHowTo')}</p>
                <ol className="m-0 pl-[18px] space-y-0.5 list-decimal">
                  <li>{t('uploadStep1')}</li>
                  <li>{t('uploadStep2')}</li>
                  <li>{t('uploadStep3')}</li>
                  <li>{t('uploadStep4')}</li>
                  <li>{t('uploadStep5')}</li>
                </ol>
              </div>
            </div>

            {/* Upload button */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-[52px] bg-primary text-primary-foreground rounded-xl text-[15px] font-bold flex items-center justify-center gap-2 mb-2"
            >
              <Upload size={16} />
              {t('uploadButton')}
            </button>

            {/* Hidden file input — browser API, safe in 'use client' */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />

            {/* Cancel */}
            <button
              type="button"
              onClick={onCancel}
              className="w-full h-11 mt-2.5 bg-transparent text-muted-foreground text-[14px] font-semibold"
            >
              {t('uploadCancel')}
            </button>
          </>
        )}

        {/* ── STAGE: cropping ── */}
        {stage === 'cropping' && (
          <div className="flex flex-col items-center gap-3.5 py-2">
            <p className="text-[16px] font-bold">{t('uploadScanning')}</p>

            {/* Phone viewport showing the picked screenshot */}
            <div
              className="relative rounded-xl overflow-hidden border border-border"
              style={{ width: 220, aspectRatio: '9/16' }}
            >
              <FakePoGoScreenshot fullImage={pickedSrc} />

              {/* Scan overlay: dark vignette with a green circle targeting the avatar */}
              <div className="absolute inset-0 pointer-events-none">
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '29%',
                    width: 60,
                    height: 60,
                    marginLeft: -30,
                    marginTop: -30,
                    border: '2px solid #00b09f',
                    borderRadius: '9999px',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
                    animation: 'pogo-scan-pulse 1s ease-in-out infinite',
                  }}
                >
                  {/* Corner markers */}
                  {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                    <span
                      key={c}
                      style={{
                        position: 'absolute',
                        width: 12,
                        height: 12,
                        borderColor: '#00b09f',
                        borderStyle: 'solid',
                        borderTopWidth: c[0] === 't' ? 3 : 0,
                        borderBottomWidth: c[0] === 'b' ? 3 : 0,
                        borderLeftWidth: c[1] === 'l' ? 3 : 0,
                        borderRightWidth: c[1] === 'r' ? 3 : 0,
                        [c[0] === 't' ? 'top' : 'bottom']: -8,
                        [c[1] === 'l' ? 'left' : 'right']: -8,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[12px] text-muted-foreground">{t('uploadScanCaption')}</p>
          </div>
        )}

        {/* ── STAGE: done ── */}
        {stage === 'done' && (
          <div className="flex flex-col items-center gap-3.5 py-2">
            <p className="text-[18px] font-extrabold">{t('uploadDoneTitle')}</p>

            {croppedSrc && (
              <div
                className="rounded-full p-1.5"
                style={{ background: 'linear-gradient(135deg,#00b09f,#7ec979)' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={croppedSrc}
                  alt="avatar preview"
                  className="w-[130px] h-[130px] rounded-full block object-cover bg-[#ffe1e1]"
                />
              </div>
            )}

            <div className="flex gap-2.5 w-full">
              {/* Retry — goes back to intro */}
              <button
                type="button"
                onClick={() => setStage('intro')}
                className="flex-1 h-12 bg-card text-foreground border border-border rounded-xl text-[14px] font-bold"
              >
                {t('uploadRetry')}
              </button>

              {/* Confirm — calls parent's onPick with the cropped data URL */}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={picking}
                className="flex-1 h-12 bg-primary text-primary-foreground rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {picking ? <Loader2 size={18} className="animate-spin" /> : t('uploadConfirm')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scan pulse animation — injected as a style tag so no external CSS dep needed */}
      <style>{`
        @keyframes pogo-scan-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.06); opacity: 0.8; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes pogo-scan-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
          }
        }
      `}</style>
    </div>
  );
}
