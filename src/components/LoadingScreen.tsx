import { getTranslations } from 'next-intl/server';

// Branded loading screen — "Direction B / Sundet" (Claude Design handoff,
// 2026-06-15). The bridge-across-the-Sound medallion (the new app mark, off the
// literal Poké Ball) sits in a rounded brand tile above the wordmark, with an
// opacity-only three-dot pulse as the loading indicator — staying within the
// Banani Mint rules (white background, no gradient field, motion = opacity only).
// Reduced-motion fallback shows the dots at full opacity with no animation.
export default async function LoadingScreen() {
  const t = await getTranslations('LoadingScreen');

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('ariaLabel')}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ background: '#ffffff', color: '#000000' }}
    >
      <div className="flex flex-col items-center px-6" style={{ transform: 'translateY(-4%)' }}>
        {/* logo tile — Direction B medallion presented as the app tile */}
        <div
          className="overflow-hidden"
          style={{
            width: 108,
            height: 108,
            borderRadius: 30,
            boxShadow: '0 8px 20px rgba(0,176,159,0.25)',
          }}
        >
          <Medallion />
        </div>

        <div
          className="mt-6"
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          PoGoSundet
        </div>

        <div className="pgs-pulse mt-8 flex items-center" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        <div
          className="mt-5"
          style={{ fontSize: 15, fontWeight: 500, color: '#949494', minHeight: 20 }}
        >
          {t('status')}
        </div>
      </div>

      <style>{`
        .pgs-pulse { gap: 9px; }
        .pgs-pulse i {
          width: 9px;
          height: 9px;
          border-radius: 9999px;
          background: #00b09f;
          opacity: 0.2;
          animation: pgs-pulse 1.2s ease-in-out infinite;
        }
        .pgs-pulse i:nth-child(2) { animation-delay: 0.18s; }
        .pgs-pulse i:nth-child(3) { animation-delay: 0.36s; }
        @keyframes pgs-pulse {
          0%, 100% { opacity: 0.2; }
          40%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pgs-pulse i { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Direction B medallion — the bridge across the Sound as a wood-rimmed collectible
// on the brand teal field. Same artwork as scripts/icon-source.svg (the generated
// home-screen icon), full-bleed so the rounded tile is purely the CSS container.
function Medallion() {
  return (
    <svg
      viewBox="0 0 512 512"
      width="100%"
      height="100%"
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="ls-field" cx="0.5" cy="0.42" r="0.75">
          <stop offset="0" stopColor="#15545f" />
          <stop offset="1" stopColor="#0a2c34" />
        </radialGradient>
        <clipPath id="ls-med">
          <circle cx="256" cy="256" r="184" />
        </clipPath>
        <linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dff2ea" />
          <stop offset="1" stopColor="#69c2b4" />
        </linearGradient>
        <linearGradient id="ls-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f93a6" />
          <stop offset="1" stopColor="#103d51" />
        </linearGradient>
        <linearGradient id="ls-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eccc9b" />
          <stop offset="1" stopColor="#9c6c3c" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" fill="url(#ls-field)" />
      <g fill="none" stroke="#cfeef0" strokeOpacity="0.06" strokeWidth="3">
        <circle cx="256" cy="256" r="214" />
        <circle cx="256" cy="256" r="238" />
      </g>

      <g clipPath="url(#ls-med)">
        <rect x="72" y="72" width="368" height="186" fill="url(#ls-sky)" />
        <circle cx="350" cy="150" r="46" fill="#fff" opacity="0.30" />
        <rect x="72" y="246" width="368" height="20" fill="#6f9a4a" />
        <path d="M72 248 q40 -12 80 0 t90 -2 t100 4 t96 -2 v22 h-466 z" fill="#5d8a3e" opacity="0.7" />
        <rect x="72" y="258" width="368" height="200" fill="url(#ls-sea)" />
        <path d="M120 360 q60 -20 130 -6 t150 2" fill="none" stroke="#bfe6da" strokeOpacity="0.14" strokeWidth="10" />
        <path d="M120 408 q70 -16 150 0 t150 -4" fill="none" stroke="#bfe6da" strokeOpacity="0.10" strokeWidth="9" />
        <g stroke="#9fb4ba" strokeWidth="5" strokeLinecap="round">
          <line x1="140" y1="318" x2="140" y2="344" />
          <line x1="200" y1="306" x2="200" y2="334" />
          <line x1="262" y1="297" x2="262" y2="326" />
          <line x1="324" y1="291" x2="324" y2="320" />
          <line x1="386" y1="288" x2="386" y2="316" />
        </g>
        <path d="M70 330 Q256 286 444 282" fill="none" stroke="#aeb9bd" strokeWidth="11" strokeLinecap="round" />
        <path d="M70 336 Q256 292 444 288" fill="none" stroke="#eef3f4" strokeWidth="5" strokeLinecap="round" />
      </g>

      <circle cx="256" cy="256" r="184" fill="none" stroke="url(#ls-rim)" strokeWidth="16" />
      <circle cx="256" cy="256" r="192.5" fill="none" stroke="#5f3d1f" strokeOpacity="0.45" strokeWidth="3" />
      <circle cx="256" cy="256" r="176" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="2.5" />
    </svg>
  );
}
