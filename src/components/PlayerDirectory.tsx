'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Profile } from '@/lib/profile/helpers';
import { filterProfiles } from '@/lib/profile/filters';
import { PlayerCard } from './PlayerCard';

interface PlayerDirectoryProps {
  profiles: Profile[];
}

export function PlayerDirectory({ profiles }: PlayerDirectoryProps) {
  const t = useTranslations('PlayerDirectory');
  const [query, setQuery] = useState('');

  const filtered = filterProfiles(profiles, query);

  return (
    <div className="flex flex-col gap-4">
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

      {/* Card list */}
      {profiles.length === 0 ? (
        <p className="text-center text-muted-foreground text-[15px] py-8">{t('noPlayers')}</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground text-[15px] py-8">
          {t('noResults', { query })}
        </p>
      ) : (
        filtered.map((profile) => (
          <PlayerCard key={profile.id} profile={profile} />
        ))
      )}
    </div>
  );
}
