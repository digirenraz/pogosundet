'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { RAID_BOSSES } from '@/lib/raids/bosses';
import { ALL_POKEMON } from '@/lib/raids/pokemon';

interface BossSearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

// Autocomplete for raid boss names.
// When the input is focused and empty it shows current raid bosses as quick picks.
// When 2+ characters are typed it searches all Pokémon names.
export function BossSearch({ value, onChange, placeholder = 'Søg raid boss...' }: BossSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep local query in sync if parent value changes externally
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close dropdown when clicking outside the component
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine which suggestions to show
  const suggestions: string[] =
    query.length >= 2
      ? ALL_POKEMON.filter(p => p.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
      : (RAID_BOSSES as unknown as string[]);

  const sectionLabel = query.length >= 2 ? null : 'Aktuelle bosser';

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
        <Search size={16} className="absolute left-3 text-muted-foreground pointer-events-none" />
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

      {open && (
        <div className="absolute z-20 left-0 right-0 bg-white border border-border rounded-b-lg shadow-sm max-h-64 overflow-y-auto">
          {sectionLabel && (
            <p className="px-4 pt-2.5 pb-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
              {sectionLabel}
            </p>
          )}
          {suggestions.length === 0 ? (
            <p className="px-4 py-2.5 text-[14px] text-muted-foreground">Ingen resultater</p>
          ) : (
            suggestions.map(name => (
              <button
                key={name}
                type="button"
                onMouseDown={() => handleSelect(name)}
                className="w-full text-left px-4 py-2.5 text-[14px] text-card-foreground hover:bg-input cursor-pointer"
              >
                {name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
