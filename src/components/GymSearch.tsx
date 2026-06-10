'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, X } from 'lucide-react';
import { fetchGymNames } from '@/lib/gyms/helpers';

// Gym names come from our own `gyms` table (migration 018, issue #93).
// The previous OpenStreetMap source (Overpass leisure=pokemon_gym) is dead —
// the tag has 0 uses globally — so the list is now community-maintained:
// PM-seeded (docs/gyms-seeding.md) plus auto-learned from posted raids.

interface GymSearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

// Module-level cache so the gyms table is fetched at most once per page load.
let cachedGyms: string[] | null = null;
let fetchPromise: Promise<string[]> | null = null;

async function loadGyms(): Promise<string[]> {
  if (cachedGyms !== null) return cachedGyms;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetchGymNames().then(names => {
    // fetchGymNames already returns [] on error, so the free-text fallback
    // keeps working even when the table is empty or unreachable.
    cachedGyms = names;
    return names;
  });

  return fetchPromise;
}

// Autocomplete for Pokémon GO gym names backed by the community `gyms` table.
// Falls back to free-text entry if the list is empty or the gym isn't listed.
export function GymSearch({ value, onChange, placeholder }: GymSearchProps) {
  const t = useTranslations('GymSearch');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [gyms, setGyms] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep local query in sync if parent value changes externally
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Load gym names on mount
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

  const suggestions =
    query.length >= 2
      ? gyms.filter(g => g.toLowerCase().includes(query.toLowerCase()))
      : [];

  const showNoGyms = query.length >= 2 && gyms.length === 0;
  const showEmpty = query.length >= 2 && gyms.length > 0 && suggestions.length === 0;

  function handleSelect(name: string) {
    setQuery(name);
    onChange(name);
    setOpen(false);
  }

  function handleClear() {
    setQuery('');
    onChange('');
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <MapPin size={16} className="absolute left-3 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
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

      {open && query.length >= 2 && (
        <div className="absolute z-20 left-0 right-0 bg-white border border-border rounded-b-lg shadow-sm max-h-64 overflow-y-auto">
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
          {suggestions.map(name => (
            <button
              key={name}
              type="button"
              onMouseDown={() => handleSelect(name)}
              className="w-full text-left px-4 py-2.5 text-[14px] text-card-foreground hover:bg-input cursor-pointer"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
