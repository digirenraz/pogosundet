import Image from 'next/image';
import type { Team } from '@/lib/profile/validation';

export type AvatarTeam = Team | 'none';

interface TeamMeta {
  color: string;
  label: string;
  short: string;
}

export const TEAMS: Record<AvatarTeam, TeamMeta> = {
  mystic: { color: 'var(--color-team-mystic)', label: 'Mystic', short: 'M' },
  valor: { color: 'var(--color-team-valor)', label: 'Valor', short: 'V' },
  instinct: { color: 'var(--color-team-instinct)', label: 'Instinct', short: 'I' },
  none: { color: 'var(--color-muted)', label: '—', short: '·' },
};

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  team?: AvatarTeam | null;
  online?: boolean;
  level?: number | null;
  ring?: boolean;
  ringWidth?: number;
}

// Circular avatar with optional team-color ring, online dot, and level badge.
// All visuals follow the design tokens in globals.css. Pure presentational.
export function Avatar({
  src,
  name = '',
  size = 56,
  team = 'none',
  online = false,
  level = null,
  ring = true,
  ringWidth,
}: AvatarProps) {
  const t = TEAMS[team ?? 'none'] ?? TEAMS.none;
  const rw = ringWidth ?? Math.max(2, Math.round(size / 28));
  const inner = size - (ring ? rw * 2 : 0);
  const initials = (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0] ?? '')
    .join('')
    .toUpperCase();

  const ringBg = ring && team && team !== 'none' ? t.color : ring ? 'var(--color-muted)' : 'transparent';

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {/* team-color ring */}
      <div
        className="rounded-full box-border"
        style={{
          width: size,
          height: size,
          background: ringBg,
          padding: ring ? rw : 0,
        }}
      >
        <div
          className="rounded-full overflow-hidden flex items-center justify-center box-border bg-[#ffe1e1] text-[#7a5a5a] font-bold"
          style={{
            width: inner,
            height: inner,
            fontSize: Math.round(inner / 2.6),
            border: ring ? '2px solid var(--color-background)' : '1px solid var(--color-border)',
          }}
        >
          {src ? (
            <Image
              src={src}
              alt={name}
              width={inner}
              height={inner}
              className="w-full h-full object-cover block"
              unoptimized
            />
          ) : (
            initials
          )}
        </div>
      </div>

      {online && (
        <span
          className="absolute right-0 bottom-0 rounded-full bg-success box-border"
          style={{
            width: Math.max(10, size * 0.22),
            height: Math.max(10, size * 0.22),
            border: `${Math.max(2, size * 0.045)}px solid var(--color-background)`,
          }}
        />
      )}

      {level != null && (
        <span
          className="absolute box-border flex items-center justify-center rounded-full font-extrabold tabular-nums"
          style={{
            left: -2,
            bottom: -2,
            minWidth: Math.max(20, size * 0.38),
            height: Math.max(20, size * 0.38),
            padding: '0 6px',
            background: '#1b3a52',
            color: 'var(--color-team-instinct)',
            fontSize: Math.max(10, size * 0.2),
            border: '2px solid var(--color-background)',
            lineHeight: 1,
          }}
        >
          {level}
        </span>
      )}
    </div>
  );
}

interface TeamChipProps {
  team?: AvatarTeam | null;
  size?: 'sm' | 'md';
}

// "Team Mystic" chip used in the detail screen and "Min profil".
// Returns null for none / undefined team.
export function TeamChip({ team, size = 'sm' }: TeamChipProps) {
  if (!team || team === 'none') return null;
  const t = TEAMS[team];
  const isSm = size === 'sm';
  return (
    <span
      className="inline-flex items-center font-bold"
      style={{
        gap: 6,
        padding: isSm ? '3px 8px 3px 4px' : '5px 12px 5px 6px',
        borderRadius: 9999,
        background: `color-mix(in srgb, ${t.color} 10%, transparent)`,
        color: t.color,
        fontSize: isSm ? 11 : 13,
        letterSpacing: '0.02em',
      }}
    >
      <span
        className="inline-flex items-center justify-center font-extrabold rounded-full text-white"
        style={{
          width: isSm ? 16 : 20,
          height: isSm ? 16 : 20,
          background: t.color,
          fontSize: isSm ? 10 : 12,
        }}
      >
        {t.short}
      </span>
      Team {t.label}
    </span>
  );
}
