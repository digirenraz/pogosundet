'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Bell, Users, Zap, Info, Check } from 'lucide-react';
import { useMounted } from '@/lib/hooks/use-mounted';

const ACCENT = '#00b09f';
const STORAGE_KEY = 'pgs_ios_onboarding_done';

function isIOS(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// ── SVG Illustrations ──────────────────────────────────────────────────────

function IllustSafari() {
  return (
    <svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <rect width="280" height="180" fill="#F2F2F7" rx="12"/>
      <rect x="20" y="16" width="240" height="148" rx="12" fill="#fff" stroke="#e8e8e8" strokeWidth="1"/>
      <rect x="32" y="28" width="216" height="30" rx="8" fill="#F2F2F7"/>
      <rect x="46" y="40" width="5" height="4" rx="1" fill="#949494"/>
      <rect x="44" y="43" width="9" height="7" rx="2" fill="#949494"/>
      <rect x="60" y="39" width="110" height="7" rx="3" fill="#ccc"/>
      <path d="M228 42 a6 6 0 1 1 -4 -5.5" stroke="#949494" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M228 36 l0 3 -3 0" stroke="#949494" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="32" y="68" width="216" height="88" rx="6" fill="#f8f8f7"/>
      <rect x="116" y="82" width="48" height="48" rx="14" fill="#00b09f"/>
      <text x="140" y="112" textAnchor="middle" fill="#fff" fontSize="11" fontFamily="system-ui" fontWeight="700">PoGo</text>
      <rect x="20" y="150" width="240" height="14" fill="#fff"/>
      <rect x="20" y="150" width="240" height="1" fill="#e8e8e8"/>
      {[50, 100, 140, 180, 230].map((x, i) => (
        <rect key={i} x={x - 8} y="156" width="16" height="3" rx="1.5" fill={i === 2 ? '#007AFF' : '#ccc'}/>
      ))}
      <circle cx="50" cy="158.5" r="6" fill="none" stroke="#007AFF" strokeWidth="1.5"/>
      <circle cx="50" cy="158.5" r="2" fill="#007AFF"/>
    </svg>
  );
}

function IllustThreeDots() {
  return (
    <svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <rect width="280" height="180" fill="#F2F2F7" rx="12"/>
      <rect x="20" y="16" width="240" height="148" rx="12" fill="#fff" stroke="#e8e8e8" strokeWidth="1"/>
      <rect x="32" y="28" width="216" height="30" rx="8" fill="#F2F2F7"/>
      <rect x="44" y="39" width="5" height="4" rx="1" fill="#949494"/>
      <rect x="42" y="43" width="9" height="7" rx="2" fill="#949494"/>
      <rect x="58" y="39" width="120" height="7" rx="3" fill="#ccc"/>
      <rect x="32" y="68" width="216" height="60" rx="6" fill="#f8f8f7"/>
      <rect x="116" y="76" width="48" height="48" rx="14" fill="#00b09f"/>
      <text x="140" y="106" textAnchor="middle" fill="#fff" fontSize="11" fontFamily="system-ui" fontWeight="700">PoGo</text>
      <rect x="20" y="138" width="240" height="26" fill="#fff"/>
      <rect x="20" y="138" width="240" height="1" fill="#e8e8e8"/>
      <path d="M42 155 l-6 -6 6 -6" stroke="#007AFF" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M68 143 l6 6 -6 6" stroke="#ccc" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="126" y="145" width="14" height="12" rx="3" fill="none" stroke="#007AFF" strokeWidth="1.5"/>
      <rect x="130" y="142" width="14" height="12" rx="3" fill="none" stroke="#007AFF" strokeWidth="1.5"/>
      <path d="M182 144 l0 12 M179 144 l9 0 M179 150 l9 0" stroke="#007AFF" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="220" y="140" width="28" height="22" rx="6" fill="#007AFF" opacity="0.13"/>
      <circle cx="228" cy="151" r="2" fill="#007AFF"/>
      <circle cx="234" cy="151" r="2" fill="#007AFF"/>
      <circle cx="240" cy="151" r="2" fill="#007AFF"/>
      <circle cx="234" cy="151" r="14" fill="none" stroke="#007AFF" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.65"/>
      <text x="234" y="173" textAnchor="middle" fill="#007AFF" fontSize="8" fontFamily="system-ui" fontWeight="600">Tryk her</text>
    </svg>
  );
}

function IllustShare() {
  return (
    <svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <rect width="280" height="180" fill="#F2F2F7" rx="12"/>
      <rect x="20" y="16" width="240" height="148" rx="12" fill="#fff" stroke="#e8e8e8" strokeWidth="1"/>
      <rect x="32" y="28" width="216" height="30" rx="8" fill="#F2F2F7"/>
      <rect x="58" y="39" width="120" height="7" rx="3" fill="#ccc"/>
      <rect x="32" y="68" width="216" height="60" rx="6" fill="#f0f0f0" opacity="0.6"/>
      <rect x="20" y="138" width="240" height="26" fill="#f0f0f0" opacity="0.6"/>
      <rect x="20" y="138" width="240" height="1" fill="#e8e8e8"/>
      <rect x="140" y="54" width="122" height="76" rx="12" fill="#fff" filter="url(#shadow-share)"/>
      <defs>
        <filter id="shadow-share">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.13"/>
        </filter>
      </defs>
      <path d="M256 50 l6 5 -6 5 Z" fill="#fff"/>
      <rect x="140" y="54" width="122" height="28" rx="12" fill="#ccefeb"/>
      <rect x="140" y="68" width="122" height="14" fill="#ccefeb"/>
      <rect x="152" y="63" width="10" height="7" rx="1.5" fill="none" stroke="#00b09f" strokeWidth="1.4"/>
      <path d="M157 63 l0 -5" stroke="#00b09f" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M154.5 60.5 l2.5 -3 2.5 3" stroke="#00b09f" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="170" y="72" fill="#00b09f" fontSize="12" fontFamily="system-ui" fontWeight="700">Del</text>
      <rect x="140" y="82" width="122" height="1" fill="#e8e8e8"/>
      <rect x="152" y="90" width="14" height="5" rx="2" fill="#e8e8e8"/>
      <rect x="172" y="90" width="60" height="5" rx="2" fill="#e8e8e8"/>
      <rect x="152" y="102" width="14" height="5" rx="2" fill="#e8e8e8"/>
      <rect x="172" y="102" width="50" height="5" rx="2" fill="#e8e8e8"/>
      <circle cx="175" cy="68" r="18" fill="#00b09f" opacity="0.10"/>
    </svg>
  );
}

function IllustSheet() {
  return (
    <svg viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <rect width="280" height="200" fill="#e8e8e8" rx="12"/>
      <rect x="0" y="18" width="280" height="182" rx="16" fill="#f2f1ef"/>
      <rect x="118" y="26" width="44" height="4" rx="2" fill="#ccc"/>
      <rect x="12" y="36" width="256" height="40" rx="10" fill="#fff"/>
      <rect x="20" y="42" width="28" height="28" rx="7" fill="#00b09f"/>
      <path d="M26 60 L 42 60" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="29" y="49" width="2" height="11" rx="0.5" fill="#fff"/>
      <rect x="33" y="49" width="2" height="11" rx="0.5" fill="#fff"/>
      <rect x="28.5" y="53" width="7" height="1.5" rx="0.5" fill="#fff"/>
      <rect x="37" y="49" width="2" height="11" rx="0.5" fill="#fff"/>
      <rect x="41" y="49" width="2" height="11" rx="0.5" fill="#fff"/>
      <rect x="36.5" y="53" width="7" height="1.5" rx="0.5" fill="#fff"/>
      <text x="56" y="53" fill="#000" fontSize="11" fontFamily="system-ui" fontWeight="600">PoGoSundet</text>
      <text x="56" y="66" fill="#888" fontSize="9" fontFamily="system-ui">gosundet.vercel.app</text>
      <circle cx="254" cy="56" r="10" fill="#e0e0e0"/>
      <path d="M250 52 l8 8 M258 52 l-8 8" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/>
      {[30, 80, 130, 180, 230].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={100} r={16} fill={i === 0 ? '#d0d0d0' : i === 1 ? '#b0c8e8' : i === 2 ? '#c8d0c8' : '#b8b0cc'}/>
          <rect x={x - 16} y={112} width={32} height={5} rx={2} fill="#ccc"/>
        </g>
      ))}
      {([['#5bc8f5', 30], ['#4cd964', 80], ['#1e90ff', 130], ['#ffe14d', 180]] as [string, number][]).map(([bg, x]) => (
        <g key={x}>
          <rect x={x - 18} y={126} width={36} height={36} rx={9} fill={bg}/>
          <rect x={x - 16} y={168} width={32} height={5} rx={2} fill="#ccc"/>
        </g>
      ))}
      {[30, 90, 150, 210].map((x) => (
        <g key={x}>
          <circle cx={x} cy={186} r={14} fill="#e0e0e0"/>
          <rect x={x - 12} y={194} width={24} height={4} rx={2} fill="#ccc"/>
        </g>
      ))}
      <defs>
        <linearGradient id="fade-up" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f1ef" stopOpacity="0"/>
          <stop offset="1" stopColor="#f2f1ef" stopOpacity="0.9"/>
        </linearGradient>
      </defs>
      <rect x="0" y="155" width="280" height="45" fill="url(#fade-up)"/>
      <rect x="8" y="183" width="264" height="17" rx="8" fill="#ccefeb"/>
      <rect x="14" y="186" width="12" height="10" rx="3" fill="none" stroke="#00b09f" strokeWidth="1.2"/>
      <path d="M20 186 l0 -3 M18 184.5 l2 -2 2 2" stroke="#00b09f" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="32" y="195" fill="#00b09f" fontSize="10" fontFamily="system-ui" fontWeight="700">Føj til hjemmeskærm</text>
      <circle cx="20" cy="191" r="12" fill="#00b09f" opacity="0.12"/>
    </svg>
  );
}

function IllustAddDialog() {
  return (
    <svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <rect width="280" height="180" fill="#F2F2F7" rx="12"/>
      <rect x="20" y="16" width="240" height="148" rx="12" fill="#e0dfd8" opacity="0.7"/>
      <rect x="48" y="36" width="184" height="108" rx="14" fill="#fff" stroke="#e8e8e8" strokeWidth="1"/>
      <text x="88" y="58" fill="#007AFF" fontSize="11" fontFamily="system-ui">Annuller</text>
      <text x="140" y="58" textAnchor="middle" fill="#000" fontSize="13" fontFamily="system-ui" fontWeight="600">Tilføj til hjemmeskærm</text>
      <rect x="118" y="68" width="44" height="44" rx="10" fill="#00b09f"/>
      <text x="140" y="95" textAnchor="middle" fill="#fff" fontSize="10" fontFamily="system-ui" fontWeight="700">PoGo</text>
      <text x="140" y="122" textAnchor="middle" fill="#000" fontSize="12" fontFamily="system-ui">PoGoSundet</text>
      <rect x="48" y="120" width="184" height="1" fill="#e8e8e8"/>
      <rect x="48" y="120" width="184" height="24" rx="0 0 14 14" fill="#ccefeb"/>
      <text x="140" y="136" textAnchor="middle" fill="#00b09f" fontSize="13" fontFamily="system-ui" fontWeight="700">Tilføj</text>
      <circle cx="140" cy="132" r="18" fill="#00b09f" opacity="0.10"/>
    </svg>
  );
}

function IllustHomeScreen() {
  return (
    <svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="wp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe8c9"/>
          <stop offset="1" stopColor="#ccefeb"/>
        </linearGradient>
        <filter id="glow-hs">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="280" height="180" fill="url(#wp)" rx="12"/>
      {[
        [36, 44], [92, 44], [148, 44], [204, 44],
        [36, 104], [92, 104], [148, 104], [204, 104],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="40" height="40" rx="9" fill="#fff" opacity="0.5"/>
      ))}
      <rect x="120" y="70" width="40" height="40" rx="10" fill="#00b09f" filter="url(#glow-hs)"/>
      <g transform="translate(120,70)">
        <path d="M6 30 L 34 30" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
        <rect x="13" y="10" width="2.5" height="20" rx="1" fill="#fff"/>
        <rect x="18" y="10" width="2.5" height="20" rx="1" fill="#fff"/>
        <rect x="12" y="16" width="10" height="2" rx="1" fill="#fff"/>
        <rect x="24.5" y="10" width="2.5" height="20" rx="1" fill="#fff"/>
        <rect x="29.5" y="10" width="2.5" height="20" rx="1" fill="#fff"/>
        <rect x="23.5" y="16" width="10" height="2" rx="1" fill="#fff"/>
      </g>
      <text x="140" y="124" textAnchor="middle" fill="#000" fontSize="9" fontFamily="system-ui" fontWeight="600" opacity="0.8">PoGoSundet</text>
      <circle cx="140" cy="90" r="26" fill="none" stroke="#00b09f" strokeWidth="2" opacity="0.5" strokeDasharray="5 3"/>
      <rect x="20" y="152" width="240" height="22" rx="14" fill="#fff" opacity="0.6"/>
      {[52, 92, 140, 188, 228].map((x, i) => (
        <rect key={i} x={x - 9} y="159" width="18" height="8" rx="4" fill="#ccc" opacity="0.7"/>
      ))}
    </svg>
  );
}

function IllustNotification() {
  return (
    <svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <rect width="280" height="180" fill="#F2F2F7" rx="12"/>
      <rect x="20" y="16" width="240" height="148" rx="12" fill="#fff"/>
      <rect x="20" y="16" width="240" height="48" rx="12" fill="#00b09f"/>
      <text x="140" y="46" textAnchor="middle" fill="#fff" fontSize="13" fontFamily="system-ui" fontWeight="700">PoGoSundet</text>
      <rect x="52" y="56" width="176" height="100" rx="14" fill="#fff" stroke="#e8e8e8" strokeWidth="1"/>
      <rect x="122" y="68" width="36" height="36" rx="9" fill="#ccefeb"/>
      <path d="M140 76 a6 6 0 0 1 6 6 v5 h-12 v-5 a6 6 0 0 1 6 -6 Z" fill="#00b09f"/>
      <rect x="138" y="87" width="4" height="3" rx="0.5" fill="#00b09f"/>
      <path d="M137 90 a3 3 0 0 0 6 0" fill="#00b09f"/>
      <text x="140" y="114" textAnchor="middle" fill="#000" fontSize="10" fontFamily="system-ui" fontWeight="600">Tillad notifikationer?</text>
      <text x="140" y="126" textAnchor="middle" fill="#949494" fontSize="8" fontFamily="system-ui">PoGoSundet vil sende dig beskeder</text>
      <rect x="52" y="134" width="176" height="1" fill="#e8e8e8"/>
      <rect x="52" y="134" width="88" height="22" rx="0 0 0 14" fill="#fff"/>
      <text x="96" y="148" textAnchor="middle" fill="#949494" fontSize="11" fontFamily="system-ui">Afvis</text>
      <rect x="140" y="134" width="88" height="22" rx="0 0 14 0" fill="#ccefeb"/>
      <text x="184" y="148" textAnchor="middle" fill="#00b09f" fontSize="11" fontFamily="system-ui" fontWeight="700">Tillad</text>
      <circle cx="184" cy="144" r="16" fill="#00b09f" opacity="0.12"/>
    </svg>
  );
}

// ── Logo tile (PoGoSundet bridge icon) ─────────────────────────────────────

function LogoTile({ size = 64 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, background: ACCENT,
      boxShadow: '0 8px 20px rgba(0,176,159,0.25)', border: '4px solid #fff',
      overflow: 'hidden', flexShrink: 0,
    }}>
      <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', display: 'block' }}>
        <rect width="72" height="72" fill="#00b09f"/>
        <path d="M-2 56 Q 12 50 26 56 T 54 56 T 82 56 L 82 74 L -2 74 Z" fill="#fff" fillOpacity=".10"/>
        <path d="M-2 62 Q 14 56 30 62 T 60 62 T 82 62 L 82 74 L -2 74 Z" fill="#fff" fillOpacity=".18"/>
        <path d="M6 48 L 66 48" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
        <rect x="22" y="16" width="3.5" height="32" rx="1" fill="#fff"/>
        <rect x="30" y="16" width="3.5" height="32" rx="1" fill="#fff"/>
        <rect x="21" y="26" width="13" height="2.5" rx="1" fill="#fff"/>
        <rect x="38.5" y="16" width="3.5" height="32" rx="1" fill="#fff"/>
        <rect x="46.5" y="16" width="3.5" height="32" rx="1" fill="#fff"/>
        <rect x="37.5" y="26" width="13" height="2.5" rx="1" fill="#fff"/>
        <path d="M28 18 L 12 48" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        <path d="M28 18 L 20 48" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        <path d="M28 18 L 36 48" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        <path d="M44.5 18 L 36 48" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        <path d="M44.5 18 L 52 48" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        <path d="M44.5 18 L 60 48" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      </svg>
    </div>
  );
}

// ── Hero illustration (bridge landscape) ──────────────────────────────────

function HeroIllustration() {
  return (
    <svg viewBox="0 0 800 320" xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id="hi-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe8c9"/>
          <stop offset="0.55" stopColor="#ccefeb"/>
          <stop offset="1" stopColor="#e6f4f2"/>
        </linearGradient>
        <linearGradient id="hi-hills" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5bb97a"/><stop offset="1" stopColor="#3f9b63"/>
        </linearGradient>
        <linearGradient id="hi-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#00b09f"/><stop offset="1" stopColor="#008f83"/>
        </linearGradient>
        <radialGradient id="hi-sun" cx="720" cy="60" r="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd264"/>
          <stop offset="1" stopColor="#ffd264" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="800" height="320" fill="url(#hi-sky)"/>
      <circle cx="720" cy="60" r="120" fill="url(#hi-sun)" opacity="0.7"/>
      <circle cx="720" cy="60" r="30" fill="#ffc441"/>
      <g fill="#fff" opacity="0.85">
        <ellipse cx="140" cy="70" rx="52" ry="9"/>
        <ellipse cx="170" cy="62" rx="30" ry="6"/>
        <ellipse cx="430" cy="52" rx="70" ry="7"/>
        <ellipse cx="470" cy="45" rx="32" ry="5"/>
      </g>
      <path d="M160 170 L 640 170" stroke="#1b3a52" strokeWidth="3" strokeLinecap="round"/>
      <g fill="#1b3a52">
        <rect x="286" y="74" width="7" height="96" rx="1.5"/>
        <rect x="318" y="74" width="7" height="96" rx="1.5"/>
        <rect x="282" y="104" width="47" height="5" rx="1.5"/>
        <rect x="282" y="138" width="47" height="5" rx="1.5"/>
        <rect x="475" y="74" width="7" height="96" rx="1.5"/>
        <rect x="507" y="74" width="7" height="96" rx="1.5"/>
        <rect x="471" y="104" width="47" height="5" rx="1.5"/>
        <rect x="471" y="138" width="47" height="5" rx="1.5"/>
      </g>
      <g stroke="#1b3a52" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity=".85">
        <path d="M308 80 L 170 170"/><path d="M308 80 L 210 170"/>
        <path d="M308 80 L 250 170"/><path d="M308 80 L 290 170"/>
        <path d="M308 80 L 350 170"/><path d="M308 80 L 390 170"/>
        <path d="M497 80 L 410 170"/><path d="M497 80 L 450 170"/>
        <path d="M497 80 L 540 170"/><path d="M497 80 L 580 170"/>
        <path d="M497 80 L 620 170"/>
      </g>
      <path d="M0 220 Q 200 200 400 218 T 800 215 L 800 260 L 0 260 Z" fill="url(#hi-hills)"/>
      <g fill="#ee2a36">
        <rect x="110" y="208" width="14" height="12"/>
        <rect x="132" y="210" width="10" height="10"/>
      </g>
      <g fill="#f5efe3">
        <rect x="108" y="201" width="18" height="8"/>
        <rect x="130" y="204" width="14" height="7"/>
      </g>
      <path d="M0 258 L 800 258 L 800 320 L 0 320 Z" fill="url(#hi-water)"/>
      <g stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" fill="none">
        <path d="M50 275 q 8 -4 16 0"/><path d="M160 288 q 10 -4 20 0"/>
        <path d="M280 272 q 8 -4 16 0"/><path d="M540 278 q 10 -4 20 0"/>
        <path d="M660 292 q 8 -4 16 0"/><path d="M120 300 q 10 -4 20 0"/>
        <path d="M400 296 q 10 -4 20 0"/>
      </g>
      <g opacity="0.95">
        <g transform="translate(210 108)">
          <circle r="22" fill="#fff"/>
          <path d="M-22 0 A 22 22 0 0 1 22 0 Z" fill="#ee2a36"/>
          <rect x="-22" y="-2.4" width="44" height="4.8" fill="#1a1a1a"/>
          <circle r="5.6" fill="#fff" stroke="#1a1a1a" strokeWidth="1.8"/>
        </g>
        <g transform="translate(400 86)">
          <circle r="14" fill="#fff"/>
          <path d="M-14 0 A 14 14 0 0 1 14 0 Z" fill="#00b09f"/>
          <rect x="-14" y="-1.6" width="28" height="3.2" fill="#1a1a1a"/>
          <circle r="3.4" fill="#fff" stroke="#1a1a1a" strokeWidth="1.3"/>
        </g>
        <g transform="translate(590 118)">
          <circle r="18" fill="#fff"/>
          <path d="M-18 0 A 18 18 0 0 1 18 0 Z" fill="#f5b70c"/>
          <rect x="-18" y="-2" width="36" height="4" fill="#1a1a1a"/>
          <circle r="4.4" fill="#fff" stroke="#1a1a1a" strokeWidth="1.5"/>
        </g>
      </g>
    </svg>
  );
}

// ── Progress dots ──────────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-1.5 justify-center items-center">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: 6,
          width: i === current ? 20 : 6,
          borderRadius: 3,
          background: i === current ? ACCENT : '#e8e8e8',
          transition: 'all 0.25s ease',
        }}/>
      ))}
    </div>
  );
}

// ── Step definitions ───────────────────────────────────────────────────────

interface StepDef {
  num: string;
  titleKey: string;
  bodyKey: string;
  tipKey?: string;
  Illust: React.FC;
}

const STEP_DEFS: StepDef[] = [
  { num: '1', titleKey: 'step1Title', bodyKey: 'step1Body', Illust: IllustSafari },
  { num: '2', titleKey: 'step2Title', bodyKey: 'step2Body', Illust: IllustThreeDots },
  { num: '3', titleKey: 'step3Title', bodyKey: 'step3Body', Illust: IllustShare },
  { num: '4', titleKey: 'step4Title', bodyKey: 'step4Body', tipKey: 'step4Tip', Illust: IllustSheet },
  { num: '5', titleKey: 'step5Title', bodyKey: 'step5Body', Illust: IllustAddDialog },
  { num: '6', titleKey: 'step6Title', bodyKey: 'step6Body', tipKey: 'step6Tip', Illust: IllustHomeScreen },
  { num: '7', titleKey: 'step7Title', bodyKey: 'step7Body', tipKey: 'step7Tip', Illust: IllustNotification },
];

// ── Main page ──────────────────────────────────────────────────────────────

type Screen = 'intro' | 'steps' | 'done';

export default function IosOnboardingPage() {
  const t = useTranslations('IosOnboarding');
  const router = useRouter();
  const mounted = useMounted();
  const [screen, setScreen] = useState<Screen>('intro');
  const [stepIdx, setStepIdx] = useState(0);

  // True only on the client, on iOS, when not already onboarded — gates the UI.
  const ready =
    mounted && isIOS() && !localStorage.getItem(STORAGE_KEY);

  useEffect(() => {
    // Redirect non-iOS users and users who already completed onboarding.
    if (mounted && (!isIOS() || localStorage.getItem(STORAGE_KEY))) {
      router.replace('/players');
    }
  }, [mounted, router]);

  function finish() {
    localStorage.setItem(STORAGE_KEY, 'true');
    router.push('/players');
  }

  function nav(dir: 1 | -1) {
    if (dir === 1) {
      if (stepIdx < STEP_DEFS.length - 1) setStepIdx(s => s + 1);
      else setScreen('done');
    } else {
      if (stepIdx > 0) setStepIdx(s => s - 1);
      else setScreen('intro');
    }
  }

  if (!ready) return null;

  // ── Intro screen ──
  if (screen === 'intro') {
    return (
      <div className="min-h-screen bg-white flex flex-col overflow-hidden">
        {/* Hero */}
        <div className="relative flex-shrink-0" style={{ height: 220 }}>
          <HeroIllustration/>
          <div className="absolute inset-x-0 bottom-0 h-28" style={{ background: 'linear-gradient(to bottom, transparent, #fff 95%)' }}/>
          <div className="absolute inset-x-0 flex justify-center" style={{ bottom: -32 }}>
            <LogoTile size={64}/>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 pt-12 pb-6 flex flex-col gap-5 overflow-y-auto">
          <div className="text-center">
            <h1 className="text-[22px] font-bold tracking-tight">{t('introTitle')}</h1>
            <p className="mt-2 text-[14px] text-muted-foreground leading-relaxed">{t('introSubtitle')}</p>
          </div>

          {/* Why card */}
          <div className="bg-[#fbfaf9] border border-border rounded-xl p-4 flex flex-col gap-3">
            <div className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">{t('whyTitle')}</div>
            {([
              [Bell, t('why1')],
              [Users, t('why2')],
              [Zap, t('why3')],
            ] as [React.ElementType, string][]).map(([Icon, text], i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#ccefeb' }}>
                  <Icon size={16} color={ACCENT}/>
                </div>
                <p className="text-[14px] leading-relaxed pt-1">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-2.5">
            <button
              onClick={() => { setStepIdx(0); setScreen('steps'); }}
              className="h-[52px] rounded-lg text-[15px] font-semibold text-white"
              style={{ background: ACCENT }}
            >
              {t('introCta')}
            </button>
            <p className="text-center text-[12px] text-muted-foreground">{t('introRequirement')}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Done screen ──
  if (screen === 'done') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 pb-10 gap-5 text-center">
        <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center" style={{ background: '#ccefeb' }}>
          <Check size={36} color={ACCENT}/>
        </div>
        <div>
          <div className="text-[22px] font-bold tracking-tight">{t('doneTitle')}</div>
          <p className="mt-2 text-[14px] text-muted-foreground leading-relaxed">{t('doneSubtitle')}</p>
        </div>
        <div className="w-full flex flex-col gap-2.5 mt-2">
          <button
            onClick={finish}
            className="h-[52px] rounded-lg text-[15px] font-semibold text-white w-full"
            style={{ background: ACCENT }}
          >
            {t('doneCta')}
          </button>
          <button
            onClick={() => { setStepIdx(0); setScreen('intro'); }}
            className="h-11 text-[13px] font-semibold text-muted-foreground bg-transparent border-0"
          >
            {t('doneRestart')}
          </button>
        </div>
      </div>
    );
  }

  // ── Step screen ──
  const step = STEP_DEFS[stepIdx];
  const isLast = stepIdx === STEP_DEFS.length - 1;
  const { Illust } = step;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top nav */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full border border-border bg-[#fbfaf9] flex items-center justify-center"
          aria-label="Tilbage"
        >
          <ArrowLeft size={18}/>
        </button>
        <ProgressDots total={STEP_DEFS.length} current={stepIdx}/>
        <button
          onClick={finish}
          className="text-[13px] font-semibold text-muted-foreground bg-transparent border-0 px-0 py-1"
        >
          {t('skip')}
        </button>
      </div>

      {/* Illustration */}
      <div className="px-5 pt-2 flex-shrink-0">
        <div className="bg-[#f8f8f7] rounded-xl overflow-hidden" style={{ height: 160 }}>
          <Illust/>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pt-3 pb-5 flex flex-col gap-2.5 overflow-y-auto">
        <div className="flex items-center gap-2.5">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
            style={{ background: ACCENT }}
          >
            {step.num}
          </span>
          <h2 className="text-[18px] font-bold tracking-tight">{t(step.titleKey as Parameters<typeof t>[0])}</h2>
        </div>
        <p className="text-[14px] leading-relaxed">{t(step.bodyKey as Parameters<typeof t>[0])}</p>
        {step.tipKey && (
          <div className="flex gap-2.5 px-3.5 py-2.5 rounded-lg items-start" style={{ background: '#ccefeb' }}>
            <Info size={16} color={ACCENT} className="flex-shrink-0 mt-0.5"/>
            <p className="text-[13px] leading-relaxed m-0">{t(step.tipKey as Parameters<typeof t>[0])}</p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-6 pb-7 flex-shrink-0">
        <button
          onClick={() => nav(1)}
          className="h-[52px] w-full rounded-lg text-[15px] font-semibold text-white"
          style={{ background: ACCENT }}
        >
          {isLast ? t('last') : t('next')}
        </button>
      </div>
    </div>
  );
}
