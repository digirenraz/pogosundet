'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { History, LocateFixed, MapPin, X } from 'lucide-react';
import { fetchGyms } from '@/lib/gyms/helpers';
import {
  buildGymSuggestions,
  type Gym,
} from '@/lib/gyms/suggestions';
import { useGeolocation } from '@/lib/hooks/use-geolocation';

// Gym names come from our own `gyms` table (migration 018, issue #93).
// The previous OpenStreetMap source (Overpass leisure=pokemon_gym) is dead —
// the tag has 0 uses globally — so the list is now community-maintained:
// PM-seeded (docs/gyms-seeding.md) plus auto-learned from posted raids.
//
// Before the user types (empty/short query) the dropdown suggests the user's
// recent gyms and — with the user's permission — the nearest gyms by distance
// (browser geolocation + the seeded coordinates; the position never leaves
// the browser). While typing, matches are distance-sorted when the position
// is known. All ranking logic lives in `buildGymSuggestions` (pure, tested).

interface GymSearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** The user's last few gym names (newest first) for the recent group. */
  recentGyms?: string[];
  /** Max characters accepted in the free-text input. */
  maxLength?: number;
}

// Module-level cache so the gyms table is fetched at most once per page load.
let cachedGyms: Gym[] | null = null;
let fetchPromise: Promise<Gym[]> | null = null;

async function loadGyms(): Promise<Gym[]> {
  if (cachedGyms !== null) return cachedGyms;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetchGyms().then(rows => {
    // fetchGyms already returns [] on error, so the free-text fallback
    // keeps working even when the table is empty or unreachable.
    cachedGyms = rows;
    return rows;
  });

  return fetchPromise;
}

// Autocomplete for Pokémon GO gym names backed by the community `gyms` table.
// Falls back to free-text entry if the list is empty or the gym isn't listed.
export function GymSearch({
  value,
  onChange,
  placeholder,
  recentGyms = [],
  maxLength,
}: GymSearchProps) {
  const t = useTranslations('GymSearch');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { status: geoStatus, position, request: requestLocation } = useGeolocation();

  // Keep local query in sync if parent value changes externally
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Load gyms on mount
  useEffect(() => {
    loadGyms().then(setGyms);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const suggestions = buildGymSuggestions({
    gyms,
    recentNames: recentGyms,
    position,
    query,
  });

  const showNoGyms = suggestions.mode === 'search' && gyms.length === 0;
  const showEmpty =
    suggestions.mode === 'search' &&
    gyms.length > 0 &&
    suggestions.matches.length === 0;

  // Browse mode renders when there is anything to show: a recent group, a
  // nearby group, or the location-request button ('idle'). With nothing to
  // show (e.g. permission denied and no recent gyms) there is no dropdown.
  const showBrowse =
    suggestions.mode === 'browse' &&
    (suggestions.recent.length > 0 ||
      suggestions.nearby.length > 0 ||
      geoStatus === 'idle');

  function handleSelect(name: string) {
    setQuery(name);
    onChange(name);
    setOpen(false);
  }

  function handleClear() {
    setQuery('');
    onChange('');
  }

  const groupHeaderClass =
    'flex items-center gap-1.5 px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
  const rowClass =
    'w-full flex items-center gap-2 text-left px-4 py-2.5 text-[14px] text-card-foreground hover:bg-input cursor-pointer';

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <MapPin size={16} className="absolute left-3 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          maxLength={maxLength}
          placeholder={placeholder ?? t('placeholder')}
          onFocus={() => setOpen(true)}
          onChange={e => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          className="w-full border border-border rounded-lg pl-9 pr-9 py-2.5 text-[15px] bg-background text-card-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 text-muted-foreground"
            aria-label={t('clear')}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {open && (suggestions.mode === 'search' || showBrowse) && (
        <div
          data-testid="gym-suggestions"
          className="absolute z-20 left-0 right-0 bg-white border border-border rounded-b-lg shadow-sm max-h-64 overflow-y-auto"
        >
          {suggestions.mode === 'search' ? (
            <>
              {showNoGyms && (
                <p className="px-4 py-2.5 text-[13px] text-muted-foreground">
                  {t('emptyList')}
                </p>
              )}
              {showEmpty && (
                <p className="px-4 py-2.5 text-[13px] text-muted-foreground">
                  {t('noMatch')}
                </p>
              )}
              {suggestions.matches.map(match => (
                <button
                  key={match.name}
                  type="button"
                  onMouseDown={() => handleSelect(match.name)}
                  className={rowClass}
                >
                  <span className="flex-1 truncate">{match.name}</span>
                  {match.distanceLabel && (
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {match.distanceLabel}
                    </span>
                  )}
                </button>
              ))}
            </>
          ) : (
            <>
              {/* Recent gyms — the user's own last posted gym names */}
              {suggestions.recent.length > 0 && (
                <>
                  <p className={groupHeaderClass}>
                    <History size={12} />
                    {t('recentHeader')}
                  </p>
                  {suggestions.recent.map(name => (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={() => handleSelect(name)}
                      className={rowClass}
                    >
                      <span className="flex-1 truncate">{name}</span>
                    </button>
                  ))}
                </>
              )}

              {/* Nearby gyms — only with a located position */}
              {suggestions.nearby.length > 0 && (
                <>
                  <p className={groupHeaderClass}>
                    <MapPin size={12} />
                    {t('nearbyHeader')}
                  </p>
                  {suggestions.nearby.map(gym => (
                    <button
                      key={gym.name}
                      type="button"
                      onMouseDown={() => handleSelect(gym.name)}
                      className={rowClass}
                    >
                      <span className="flex-1 truncate">{gym.name}</span>
                      <span className="shrink-0 text-[12px] text-muted-foreground">
                        {gym.distanceLabel}
                      </span>
                    </button>
                  ))}
                </>
              )}

              {/* Permission not granted yet — explicit user action triggers
                  the browser's geolocation prompt (GDPR: never silent). */}
              {geoStatus === 'idle' && (
                <button
                  type="button"
                  onMouseDown={e => {
                    // Keep the input focused (and the dropdown open) while
                    // the permission prompt / position lookup runs.
                    e.preventDefault();
                    requestLocation();
                  }}
                  className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-[14px] font-semibold text-primary hover:bg-input cursor-pointer"
                >
                  <LocateFixed size={16} />
                  {t('useLocation')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
