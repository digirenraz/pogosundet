import { getTranslations } from 'next-intl/server';

// Branded loading screen based on the "Sonar over Sundet" Claude Design handoff
// (loading-screen bundle, 2026-05-18). Concentric teal rings expand outward from
// a centered Pokéball, with coloured trainer "blip" dots flashing at the rim.
// Reduced-motion fallback freezes the pulses and shows only the dot indicator.
export default async function LoadingScreen() {
  const t = await getTranslations('LoadingScreen');

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('ariaLabel')}
      className="fixed inset-0 z-50 overflow-hidden"
      style={{
        background:
          'radial-gradient(120% 80% at 50% 38%, #e6f4f2 0%, #ccefeb 45%, #b3e3dc 100%)',
        color: '#0e2a26',
      }}
    >
      <div className="absolute left-0 right-0 top-[86px] flex justify-center z-[5]">
        <Wordmark />
      </div>

      <div className="pgs-loader-stage">
        <svg viewBox="0 0 320 320" className="pgs-loader-ticks" aria-hidden="true">
          <g stroke="#00b09f" strokeOpacity="0.18" strokeWidth="1" fill="none">
            <circle cx="160" cy="160" r="150" />
            <circle cx="160" cy="160" r="118" />
            <circle cx="160" cy="160" r="86" />
            <line x1="160" y1="6" x2="160" y2="22" />
            <line x1="160" y1="298" x2="160" y2="314" />
            <line x1="6" y1="160" x2="22" y2="160" />
            <line x1="298" y1="160" x2="314" y2="160" />
          </g>
          <text
            x="160"
            y="0"
            textAnchor="middle"
            dy="-2"
            fontSize="11"
            fontWeight="700"
            fill="#00b09f"
            opacity="0.5"
            letterSpacing="2"
          >
            N
          </text>
        </svg>

        <div className="pgs-loader-pulse pgs-loader-pulse-1" />
        <div className="pgs-loader-pulse pgs-loader-pulse-2" />
        <div className="pgs-loader-pulse pgs-loader-pulse-3" />

        <div className="pgs-loader-blip pgs-loader-blip-1" />
        <div className="pgs-loader-blip pgs-loader-blip-2" />
        <div className="pgs-loader-blip pgs-loader-blip-3" />

        <div className="pgs-loader-ball">
          <Pokeball size={108} />
        </div>
      </div>

      <div className="absolute left-0 right-0 bottom-[92px] flex flex-col items-center gap-1.5 z-[6]">
        <div className="inline-flex items-baseline gap-1.5 text-[18px] font-bold tracking-[-0.01em]">
          <span>{t('status')}</span>
          <span className="pgs-loader-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
        <div className="text-[13px] font-semibold opacity-70">{t('subtitle')}</div>
      </div>

      <style>{`
        .pgs-loader-stage {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 320px;
          height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }
        .pgs-loader-ticks { position: absolute; inset: 0; width: 100%; height: 100%; }
        .pgs-loader-ball {
          position: relative;
          z-index: 4;
          animation: pgs-ball-pulse 2.4s ease-in-out infinite;
        }
        .pgs-loader-pulse {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 2px solid #00b09f;
          transform: translate(-50%, -50%) scale(0.4);
          opacity: 0;
          animation: pgs-sonar-pulse 2.4s cubic-bezier(0.2, 0.6, 0.2, 1) infinite;
        }
        .pgs-loader-pulse-1 { animation-delay: 0s; }
        .pgs-loader-pulse-2 { animation-delay: 0.8s; }
        .pgs-loader-pulse-3 { animation-delay: 1.6s; }

        .pgs-loader-blip {
          position: absolute;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          opacity: 0;
          animation: pgs-blip-flash 2.4s ease-out infinite;
        }
        .pgs-loader-blip-1 {
          left: calc(50% - 86px);
          top: calc(50% - 64px);
          animation-delay: 0.6s;
          background: #ee2a36;
          box-shadow: 0 0 0 4px rgba(238, 42, 54, 0.20);
        }
        .pgs-loader-blip-2 {
          left: calc(50% + 72px);
          top: calc(50% - 28px);
          animation-delay: 1.1s;
          background: #f5b70c;
          box-shadow: 0 0 0 4px rgba(245, 183, 12, 0.22);
        }
        .pgs-loader-blip-3 {
          left: calc(50% + 24px);
          top: calc(50% + 86px);
          animation-delay: 1.8s;
          background: #2d7ff9;
          box-shadow: 0 0 0 4px rgba(45, 127, 249, 0.20);
        }

        .pgs-loader-dots {
          display: inline-flex;
          gap: 4px;
          align-items: baseline;
          margin-left: 2px;
          transform: translateY(-2px);
        }
        .pgs-loader-dots > span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          display: inline-block;
          background: #00b09f;
          animation: pgs-loader-dot 1.2s ease-in-out infinite;
        }
        .pgs-loader-dots > span:nth-child(2) { animation-delay: 0.15s; }
        .pgs-loader-dots > span:nth-child(3) { animation-delay: 0.30s; }

        @keyframes pgs-sonar-pulse {
          0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0.85; border-width: 3px; }
          80%  { opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(4.0); opacity: 0; border-width: 1px; }
        }
        @keyframes pgs-ball-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.04); }
        }
        @keyframes pgs-blip-flash {
          0%, 35%  { opacity: 0; transform: scale(0.4); }
          50%      { opacity: 1; transform: scale(1); }
          85%      { opacity: 0.6; }
          100%     { opacity: 0; transform: scale(0.8); }
        }
        @keyframes pgs-loader-dot {
          0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
          30%           { opacity: 1;    transform: translateY(-2px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .pgs-loader-pulse-2,
          .pgs-loader-pulse-3,
          .pgs-loader-blip { display: none; }
          .pgs-loader-pulse-1 {
            animation: none;
            opacity: 0.4;
            transform: translate(-50%, -50%) scale(2.4);
          }
          .pgs-loader-ball { animation: none; }
        }
      `}</style>
    </div>
  );
}

// Brand wordmark — mini bridge tile glyph + "PoGoSundet" lockup. Direct port of
// the Wordmark SVG from loaders.jsx so the loader stays visually identical to
// the design handoff. Sized at 196×40 for the loading-screen header.
function Wordmark() {
  return (
    <svg width="196" height="40" viewBox="0 0 280 60" fill="none" aria-label="PoGoSundet">
      <rect x="0" y="6" width="48" height="48" rx="13" fill="#00b09f" />
      <path d="M-2 44 Q 8 41 18 44 T 38 44 T 50 44 L 50 56 L -2 56 Z" fill="#fff" fillOpacity=".10" />
      <path d="M-2 49 Q 10 46 22 49 T 42 49 T 50 49 L 50 56 L -2 56 Z" fill="#fff" fillOpacity=".16" />
      <g transform="translate(0 6) scale(0.667)">
        <path d="M8 50 L 64 50" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <g fill="#fff">
          <rect x="23" y="16" width="2.2" height="34" rx="1" />
          <rect x="29" y="16" width="2.2" height="34" rx="1" />
          <rect x="22" y="24" width="10" height="1.8" rx="0.9" />
          <rect x="40.6" y="16" width="2.2" height="34" rx="1" />
          <rect x="46.6" y="16" width="2.2" height="34" rx="1" />
          <rect x="39.6" y="24" width="10" height="1.8" rx="0.9" />
        </g>
        <g stroke="#fff" strokeWidth="0.9" strokeLinecap="round" opacity=".9" fill="none">
          <path d="M27 18 L 11 50" />
          <path d="M27 18 L 19 50" />
          <path d="M27 18 L 35 50" />
          <path d="M44.7 18 L 32 50" />
          <path d="M44.7 18 L 53 50" />
          <path d="M44.7 18 L 61 50" />
        </g>
      </g>
      <text
        x="62"
        y="42"
        fontWeight="800"
        fontSize="28"
        letterSpacing="-0.56"
        fill="#0e2a26"
      >
        PoGoSundet
      </text>
    </svg>
  );
}

function Pokeball({ size }: { size: number }) {
  const stroke = Math.max(1.4, size * 0.05);
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true">
      <ellipse cx="0" cy="46" rx="34" ry="5" fill="#000" opacity="0.18" />
      <circle r="46" fill="#fff" stroke="#1a1a1a" strokeWidth={stroke} />
      <path d="M-46 0 A 46 46 0 0 1 46 0 Z" fill="#ee2a36" stroke="#1a1a1a" strokeWidth={stroke} />
      <rect x="-46" y="-4" width="92" height="8" fill="#1a1a1a" />
      <circle r="11" fill="#fff" stroke="#1a1a1a" strokeWidth={stroke * 1.2} />
      <circle r="5" fill="#fff" stroke="#1a1a1a" strokeWidth={stroke * 0.6} />
    </svg>
  );
}
