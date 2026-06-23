'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Profile } from '@/lib/profile/helpers';
import { track } from '@/lib/analytics/amplitude';
import { filterProfiles, type DirectoryFilter } from '@/lib/profile/filters';
import { PlayerCard } from './PlayerCard';

interface PlayerDirectoryProps {
  profiles: Profile[];
  currentUserId: string;
  // Online user IDs come from the parent's single `usePresence` subscription
  // (see PlayersScreen) so the mobile + desktop layouts don't each open a
  // colliding `players-online` channel.
  onlineUserIds: Set<string>;
  // Target user_ids the current user has already marked "added" in the desktop
  // scan-session — drives the subtle "Allerede tilføjet" hint on each card.
  addedUserIds: Set<string>;
}

const TEAM_COLOR: Record<DirectoryFilter, string> = {
  all: 'var(--color-muted-foreground)',
  online: 'var(--color-success)',
  mystic: 'var(--color-team-mystic)',
  valor: 'var(--color-team-valor)',
  instinct: 'var(--color-team-instinct)',
};

export function PlayerDirectory({
  profiles,
  currentUserId,
  onlineUserIds,
  addedUserIds,
}: PlayerDirectoryProps) {
  const t = useTranslations('PlayerDirectory');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DirectoryFilter>('all');

  // Analytics: fire one debounced player_search per typed query. The query
  // string is deliberately NOT sent (free-text → PII risk); we only record
  // that a search happened.
  useEffect(() => {
    if (!query.trim()) return;
    const id = setTimeout(() => track('player_search'), 600);
    return () => clearTimeout(id);
  }, [query]);

  const othersProfiles = useMemo(
    () => profiles.filter((p) => p.user_id !== currentUserId),
    [profiles, currentUserId]
  );

  const filtered = useMemo(
    () => filterProfiles(othersProfiles, { query, filter, onlineUserIds }),
    [othersProfiles, query, filter, onlineUserIds]
  );

  const onlineCount = useMemo(
    () => othersProfiles.filter((p) => onlineUserIds.has(p.user_id)).length,
    [othersProfiles, onlineUserIds]
  );

  const chips: { key: DirectoryFilter; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'online', label: t('filterOnline', { count: onlineCount }) },
    { key: 'mystic', label: t('filterMystic') },
    { key: 'valor', label: t('filterValor') },
    { key: 'instinct', label: t('filterInstinct') },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div className="flex items-center gap-3 bg-input rounded-[24px] px-4 py-2">
        <Search size={20} className="text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 py-0.5">
        {chips.map((c) => {
          const active = filter === c.key;
          const color = TEAM_COLOR[c.key];
          const isTeam = c.key === 'mystic' || c.key === 'valor' || c.key === 'instinct';
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold"
              style={{
                border: active ? `1.5px solid ${color}` : isTeam ? `1px solid ${color}` : '1px solid var(--color-border)',
                background: active ? `color-mix(in srgb, ${color} 8%, transparent)` : 'var(--color-card)',
                color: active ? color : isTeam ? color : 'var(--color-muted-foreground)',
                opacity: isTeam && !active ? 0.55 : 1,
              }}
            >
              {c.key === 'online' && (
                <span className="w-2 h-2 rounded-full bg-success" />
              )}
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Card list */}
      {profiles.length === 0 ? (
        <p className="text-center text-muted-foreground text-[15px] py-8">{t('noPlayers')}</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground text-[15px] py-8">
          {query ? t('noResults', { query }) : t('noFilterResults')}
        </p>
      ) : (
        <>
          <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider px-0.5 pt-1">
            {t('countLabel', { count: filtered.length })}
          </div>
          <div className="flex flex-col gap-3">
            {filtered.map((profile) => (
              <PlayerCard
                key={profile.id}
                profile={profile}
                online={onlineUserIds.has(profile.user_id)}
                added={addedUserIds.has(profile.user_id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
