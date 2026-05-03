'use client';

import { useState, useRef, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';

interface GymSearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

// Module-level cache so OSM is fetched at most once per page load.
let cachedGyms: string[] | null = null;
let fetchPromise: Promise<string[]> | null = null;

// Fetch Pokémon GO gyms from OpenStreetMap within 25 km of Frederikssund.
async function fetchOsmGyms(): Promise<string[]> {
  if (cachedGyms !== null) return cachedGyms;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const query = '[out:json][timeout:15];node["leisure"="pokemon_gym"](around:25000,55.8406,12.0654);out body;';
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!response.ok) return [];
      const json = await response.json();
      const names: string[] = (json.elements ?? [])
        .map((el: { tags?: { name?: string } }) => el.tags?.name)
        .filter((n: string | undefined): n is string => typeof n === 'string' && n.length > 0);
      cachedGyms = names;
      return names;
    } catch {
      // Graceful fallback: OSM unavailable — user can still type manually
      cachedGyms = [];
      return [];
    }
  })();

  return fetchPromise;
}

// Autocomplete for Pokémon GO gym names using OpenStreetMap data.
// Falls back to free-text entry if OSM is unavailable or the gym isn't listed.
export function GymSearch({ value, onChange, placeholder = 'Søg gym...' }: GymSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [gyms, setGyms] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep local query in sync if parent value changes externally
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Load OSM gyms on mount
  useEffect(() => {
    fetchOsmGyms().then(setGyms);
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

  const showNoOsm = query.length >= 2 && gyms.length === 0;
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
          placeholder={placeholder}
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
            aria-label="Ryd"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute z-20 left-0 right-0 bg-white border border-border rounded-b-lg shadow-sm max-h-64 overflow-y-auto">
          {showNoOsm && (
            <p className="px-4 py-2.5 text-[13px] text-muted-foreground">
              Ingen gyms fundet i OSM — skriv navnet manuelt
            </p>
          )}
          {showEmpty && (
            <p className="px-4 py-2.5 text-[13px] text-muted-foreground">
              Ingen gyms fundet — skriv navnet manuelt
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
