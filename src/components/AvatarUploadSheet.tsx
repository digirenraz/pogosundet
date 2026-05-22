'use client';

import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Stage = 'intro' | 'position' | 'done';

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
// Helpers for the drag-to-position stage
// ---------------------------------------------------------------------------

const CIRCLE_SIZE = 280;

function coverScale(nw: number, nh: number) {
  return Math.max(CIRCLE_SIZE / nw, CIRCLE_SIZE / nh);
}

function clampOffset(ox: number, oy: number, nw: number, nh: number, effectiveScale: number) {
  return {
    x: Math.min(0, Math.max(CIRCLE_SIZE - nw * effectiveScale, ox)),
    y: Math.min(0, Math.max(CIRCLE_SIZE - nh * effectiveScale, oy)),
  };
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
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 0, h: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1); // multiplier on top of cover scale; 1 = cover
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistRef = useRef<number | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPickedSrc(url);
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: nw, naturalHeight: nh } = img;
      setImgNaturalSize({ w: nw, h: nh });
      const sc = coverScale(nw, nh);
      setScale(1);
      // Start at top-center so the avatar (typically near the top) is visible
      setOffset({ x: (CIRCLE_SIZE - nw * sc) / 2, y: 0 });
      setStage('position');
    };
    img.src = url;
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    } else {
      // Second finger down — switch to pinch mode, cancel drag
      dragRef.current = null;
      const pts = [...pointersRef.current.values()];
      lastPinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { w: nw, h: nh } = imgNaturalSize;
    if (!nw) return;

    if (pointersRef.current.size >= 2) {
      // Pinch-to-zoom
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (lastPinchDistRef.current !== null && lastPinchDistRef.current > 0) {
        const ratio = dist / lastPinchDistRef.current;
        const newScale = Math.max(1, Math.min(6, scale * ratio));
        const cs = coverScale(nw, nh);
        const eff = cs * newScale;
        setScale(newScale);
        setOffset(prev => clampOffset(prev.x, prev.y, nw, nh, eff));
      }
      lastPinchDistRef.current = dist;
    } else if (dragRef.current) {
      // Single-finger drag
      const { sx, sy, ox, oy } = dragRef.current;
      const eff = coverScale(nw, nh) * scale;
      setOffset(clampOffset(ox + e.clientX - sx, oy + e.clientY - sy, nw, nh, eff));
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) lastPinchDistRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
  }

  function commitCrop() {
    if (!pickedSrc || !imgNaturalSize.w) return;
    const img = new Image();
    img.onload = () => {
      const eff = coverScale(img.naturalWidth, img.naturalHeight) * scale;
      const canvas = document.createElement('canvas');
      canvas.width = 200; canvas.height = 200;
      const ctx = canvas.getContext('2d')!;
      ctx.beginPath(); ctx.arc(100, 100, 100, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(
        img,
        -offset.x / eff, -offset.y / eff,
        CIRCLE_SIZE / eff, CIRCLE_SIZE / eff,
        0, 0, 200, 200,
      );
      setCroppedSrc(canvas.toDataURL('image/png'));
      setStage('done');
    };
    img.src = pickedSrc;
  }

  async function handleConfirm() {
    if (!croppedSrc) return;
    setPicking(true);
    await onPick(croppedSrc);
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

        {/* ── STAGE: position ── */}
        {stage === 'position' && (
          <div className="flex flex-col items-center gap-3 py-2">
            <p className="text-[16px] font-bold self-start">{t('uploadPositionTitle')}</p>

            {/* Circular drag viewport */}
            <div
              style={{
                width: CIRCLE_SIZE, height: CIRCLE_SIZE,
                borderRadius: '50%', overflow: 'hidden',
                position: 'relative', flexShrink: 0,
                border: '3px solid #00b09f',
                cursor: 'grab', touchAction: 'none', userSelect: 'none',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {pickedSrc && imgNaturalSize.w > 0 && (() => {
                const eff = coverScale(imgNaturalSize.w, imgNaturalSize.h) * scale;
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pickedSrc}
                    alt=""
                    draggable={false}
                    style={{
                      position: 'absolute',
                      width: imgNaturalSize.w * eff,
                      height: imgNaturalSize.h * eff,
                      maxWidth: 'none',  // override global img { max-width: 100% }
                      left: offset.x,
                      top: offset.y,
                      userSelect: 'none',
                      pointerEvents: 'none',
                    }}
                  />
                );
              })()}
            </div>

            <p className="text-[12px] text-muted-foreground">{t('uploadPositionHint')}</p>

            <div className="flex gap-2.5 w-full mt-1">
              <button
                type="button"
                onClick={() => setStage('intro')}
                className="flex-1 h-12 bg-card text-foreground border border-border rounded-xl text-[14px] font-bold"
              >
                {t('uploadRetry')}
              </button>
              <button
                type="button"
                onClick={commitCrop}
                className="flex-1 h-12 bg-primary text-primary-foreground rounded-xl text-[14px] font-bold"
              >
                {t('uploadConfirm')}
              </button>
            </div>
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

    </div>
  );
}
