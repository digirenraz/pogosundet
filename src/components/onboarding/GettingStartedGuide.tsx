'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Smartphone, Share2, Info, Lightbulb, Copy } from 'lucide-react';
import { FriendCodeQR } from '@/components/FriendCodeQR';

// ---------------------------------------------------------------------------
// GettingStartedGuide — the "Kom i gang" content (Claude Design handoff
// `Kom i gang.dc.html`). Layout-agnostic: the page wraps it in the desktop
// shell at lg+ and in mobile chrome below. Two sections:
//   1. Install the PWA (Android / iOS cards)
//   2. Add friends via QR from the desktop scan-session (steps + panel replica)
//
// Brand-ink hex (#0a1f27 / #1f2a2e) and the darker teal accent (#00897c) have
// no @theme token, so they're hardcoded — same convention as AppHeader and the
// profile page. Token-backed colours use the var()/Tailwind tokens.
// ---------------------------------------------------------------------------

const INK = '#0a1f27';
const TEAL_DARK = '#00897c';

// The scan panel is an illustrative replica of the real scan-session, not the
// viewer's own data — sample trainer + friend code, like the design.
const SAMPLE_NAME = 'Renraz666170870';
const SAMPLE_CODE = '0296 3662 1882';
const SAMPLE_LEVEL = 80;

// Shared rich-text chunk so `<b>…</b>` in the messages renders as bold.
const bold = (chunks: ReactNode) => <strong className="font-bold">{chunks}</strong>;

// One numbered install step (small teal pill + text).
function InstallStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3 items-start">
      <span
        className="w-6 h-6 flex-none rounded-full text-[13px] font-bold flex items-center justify-center"
        style={{ background: 'var(--color-secondary)', color: TEAL_DARK }}
      >
        {n}
      </span>
      <span className="text-[15px] leading-snug" style={{ color: '#1f2a2e' }}>
        {children}
      </span>
    </li>
  );
}

// One install card (platform header + ordered steps).
function InstallCard({
  icon,
  title,
  sub,
  children,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-[14px] p-6">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center"
          style={{ background: '#e6f4f2' }}
        >
          {icon}
        </div>
        <div className="leading-tight">
          <div className="text-[16px] font-bold whitespace-nowrap" style={{ color: INK }}>
            {title}
          </div>
          <div className="text-[13px] font-semibold text-muted-foreground">{sub}</div>
        </div>
      </div>
      <ol className="m-0 p-0 list-none flex flex-col gap-[15px]">{children}</ol>
    </div>
  );
}

// One QR walkthrough step in the vertical timeline.
function QrStep({
  n,
  last,
  title,
  body,
}: {
  n: number;
  last?: boolean;
  title: string;
  body: ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center flex-none">
        <span className="w-[30px] h-[30px] rounded-full bg-primary text-primary-foreground text-[14px] font-bold flex items-center justify-center">
          {n}
        </span>
        {!last && <span className="w-0.5 flex-1 min-h-[18px]" style={{ background: '#e0ece9' }} />}
      </div>
      <div className={last ? '' : 'pb-5'}>
        <div className="text-[16px] font-bold" style={{ color: INK }}>
          {title}
        </div>
        <div className="text-[14px] leading-relaxed text-muted-foreground mt-0.5">{body}</div>
      </div>
    </li>
  );
}

export function GettingStartedGuide() {
  const t = useTranslations('Onboarding');
  const [copied, setCopied] = useState(false);

  function copyCode() {
    try {
      navigator.clipboard.writeText(SAMPLE_CODE);
    } catch {
      // Clipboard may be unavailable (insecure context) — ignore.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-[1060px] mx-auto px-5 lg:px-16 pt-[132px] lg:pt-14 pb-24 lg:pb-20">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3.5">
        <span className="text-[12px] font-bold tracking-[0.12em] uppercase text-primary whitespace-nowrap">
          {t('eyebrow')}
        </span>
        <span className="h-px flex-1 max-w-[60px]" style={{ background: '#cfe5e1' }} />
      </div>
      <h1
        className="m-0 mb-3 text-[30px] lg:text-[38px] font-extrabold tracking-tight leading-[1.1]"
        style={{ color: INK }}
      >
        {t('title')}
      </h1>
      <p className="m-0 mb-12 max-w-[620px] text-[17px] leading-relaxed text-muted-foreground text-pretty">
        {t('intro')}
      </p>

      {/* Section 1 — install */}
      <section className="mb-14">
        <div className="flex items-start gap-4 mb-6">
          <div
            className="w-10 h-10 flex-none rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-[19px] font-extrabold"
            style={{ boxShadow: '0 6px 16px rgba(0,176,159,0.28)' }}
          >
            1
          </div>
          <div>
            <h2 className="m-0 mb-1 text-[23px] font-extrabold tracking-tight" style={{ color: INK }}>
              {t('step1Title')}
            </h2>
            <p className="m-0 text-[15px] leading-snug text-muted-foreground">{t('step1Lead')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <InstallCard
            icon={<Smartphone size={20} style={{ color: TEAL_DARK }} />}
            title={t('androidTitle')}
            sub={t('androidSub')}
          >
            <InstallStep n={1}>{t.rich('android1', { b: bold })}</InstallStep>
            <InstallStep n={2}>{t.rich('android2', { b: bold })}</InstallStep>
            <InstallStep n={3}>{t.rich('android3', { b: bold })}</InstallStep>
            <InstallStep n={4}>{t.rich('android4', { b: bold })}</InstallStep>
          </InstallCard>

          <InstallCard
            icon={<Share2 size={20} style={{ color: TEAL_DARK }} />}
            title={t('iosTitle')}
            sub={t('iosSub')}
          >
            <InstallStep n={1}>{t.rich('ios1', { b: bold })}</InstallStep>
            <InstallStep n={2}>{t.rich('ios2', { b: bold })}</InstallStep>
            <InstallStep n={3}>{t.rich('ios3', { b: bold })}</InstallStep>
            <InstallStep n={4}>{t.rich('ios4', { b: bold })}</InstallStep>
          </InstallCard>
        </div>

        <div
          className="flex gap-3 items-start mt-[18px] px-4 py-3.5 rounded-[10px]"
          style={{ background: '#fff7ec', border: '1px solid #f6e2c6' }}
        >
          <Info size={18} style={{ color: '#d97a17', flex: 'none', marginTop: 1 }} />
          <p className="m-0 text-[14px] leading-relaxed" style={{ color: '#7a5a2e' }}>
            {t.rich('installNote', { b: bold })}
          </p>
        </div>
      </section>

      {/* Section 2 — QR */}
      <section>
        <div className="flex items-start gap-4 mb-6">
          <div
            className="w-10 h-10 flex-none rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-[19px] font-extrabold"
            style={{ boxShadow: '0 6px 16px rgba(0,176,159,0.28)' }}
          >
            2
          </div>
          <div>
            <h2 className="m-0 mb-1 text-[23px] font-extrabold tracking-tight" style={{ color: INK }}>
              {t('step2Title')}
            </h2>
            <p className="m-0 max-w-[640px] text-[15px] leading-snug text-muted-foreground">
              {t('step2Lead')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 lg:gap-10 items-start">
          {/* Steps */}
          <div>
            <ol className="m-0 mb-[22px] p-0 list-none flex flex-col">
              <QrStep n={1} title={t('qrStep1Title')} body={t.rich('qrStep1Body', { b: bold })} />
              <QrStep n={2} title={t('qrStep2Title')} body={t.rich('qrStep2Body', { b: bold })} />
              <QrStep n={3} title={t('qrStep3Title')} body={t.rich('qrStep3Body', { b: bold })} />
              <QrStep n={4} title={t('qrStep4Title')} body={t.rich('qrStep4Body', { b: bold })} />
              <QrStep n={5} last title={t('qrStep5Title')} body={t.rich('qrStep5Body', { b: bold })} />
            </ol>

            <div
              className="flex gap-3 items-start px-4 py-3.5 rounded-[10px]"
              style={{ background: '#e6f4f2', border: '1px solid #c7e7e1' }}
            >
              <Lightbulb size={18} style={{ color: TEAL_DARK, flex: 'none', marginTop: 1 }} />
              <p className="m-0 text-[14px] leading-relaxed" style={{ color: '#1f5a52' }}>
                {t.rich('tip', { b: bold })}
              </p>
            </div>
          </div>

          {/* Scan panel replica */}
          <div
            className="bg-background border border-border rounded-2xl p-6 lg:sticky lg:top-6"
            style={{ boxShadow: '0 12px 32px rgba(10,34,43,0.08)' }}
          >
            {/* Identity */}
            <div className="flex items-center gap-3 mb-[22px]">
              <div className="relative flex-none">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-[18px] font-bold"
                  style={{ background: '#fde2e4', border: '2px solid #ee2a36', color: '#ee2a36' }}
                >
                  R
                </div>
                <div
                  className="absolute -right-1 -bottom-1 text-[10px] font-extrabold rounded-full px-[5px] py-0.5"
                  style={{ background: '#0a2c34', color: '#f5b70c', border: '2px solid #fff' }}
                >
                  {SAMPLE_LEVEL}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[18px] font-extrabold tracking-tight leading-tight" style={{ color: INK }}>
                  {SAMPLE_NAME}
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  <span
                    className="inline-flex items-center gap-1 text-white text-[11px] font-bold rounded-full px-2 py-[3px]"
                    style={{ background: '#ee2a36' }}
                  >
                    <span
                      className="w-[13px] h-[13px] rounded-full text-[9px] font-extrabold inline-flex items-center justify-center"
                      style={{ background: '#fff', color: '#ee2a36' }}
                    >
                      V
                    </span>
                    Team Valor
                  </span>
                  <span
                    className="text-[11px] font-bold rounded-full px-2 py-[3px]"
                    style={{ background: '#0a2c34', color: '#f5b70c' }}
                  >
                    Lvl {SAMPLE_LEVEL}
                  </span>
                </div>
              </div>
            </div>

            {/* QR */}
            <div
              className="relative w-[236px] mx-auto p-[18px] bg-background rounded-[18px]"
              style={{ boxShadow: '0 4px 16px rgba(10,34,43,0.06)' }}
            >
              <FriendCodeQR value={SAMPLE_CODE} size={200} />
            </div>

            {/* Code + copy */}
            <div className="flex items-center justify-center gap-2.5 mt-[18px]">
              <span
                className="text-[21px] font-extrabold tracking-[0.1em] tabular-nums"
                style={{ color: '#123642' }}
              >
                {SAMPLE_CODE}
              </span>
              <button
                type="button"
                onClick={copyCode}
                title={copied ? t('copied') : t('copy')}
                aria-label={copied ? t('copied') : t('copy')}
                className="w-8 h-8 flex-none rounded-lg border border-border bg-card inline-flex items-center justify-center"
                style={{ color: TEAL_DARK }}
              >
                <Copy size={16} />
              </button>
            </div>

            {/* Hint */}
            <div className="flex items-center justify-center gap-2 mt-3.5 pt-3.5 border-t border-border">
              <Smartphone size={15} className="text-muted-foreground flex-none" />
              <span className="text-[12.5px] font-semibold text-muted-foreground text-center">
                {t('panelHint')}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
