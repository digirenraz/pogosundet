import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  formatDistance,
  buildGymSuggestions,
  type Gym,
} from './suggestions';

// Fixture around Frederikssund. Distances from POSITION (55.84, 12.06), by the
// haversine formula (1° latitude ≈ 111.2 km; longitude scaled by cos(lat)):
//   Frederikssund Kirke ~0 m · Svømmehallen ~128 m · Stationen ~167 m ·
//   Vandtårnet ~1.3 km · Slottet ~2.3 km · Slangerup Kirke ~7.6 km.
// Anonym Statue / Vandposten have no coordinates (auto-learned rows).
const GYMS: Gym[] = [
  { name: 'Frederikssund Kirke', lat: 55.84, lng: 12.06 },
  { name: 'Slangerup Kirke', lat: 55.85, lng: 12.18 },
  { name: 'Svømmehallen', lat: 55.841, lng: 12.061 },
  { name: 'Slottet', lat: 55.86, lng: 12.05 },
  { name: 'Stationen', lat: 55.839, lng: 12.062 },
  { name: 'Vandtårnet', lat: 55.83, lng: 12.07 },
  { name: 'Anonym Statue', lat: null, lng: null },
  { name: 'Vandposten', lat: null, lng: null },
];

const POSITION = { lat: 55.84, lng: 12.06 };

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters(POSITION, POSITION)).toBe(0);
  });

  it('measures 0.01° of latitude as ~1112 m', () => {
    // 1° of latitude is ~111.19 km on a 6371 km mean-radius Earth.
    const d = haversineMeters(
      { lat: 55.84, lng: 12.06 },
      { lat: 55.85, lng: 12.06 }
    );
    expect(d).toBeGreaterThan(1110);
    expect(d).toBeLessThan(1114);
  });

  it('scales longitude by cos(latitude): 0.01° lng at 55.84°N is ~624 m', () => {
    const d = haversineMeters(
      { lat: 55.84, lng: 12.06 },
      { lat: 55.84, lng: 12.07 }
    );
    expect(d).toBeGreaterThan(620);
    expect(d).toBeLessThan(628);
  });
});

describe('formatDistance', () => {
  it('rounds metres below 1 km to the nearest 10', () => {
    expect(formatDistance(347)).toBe('350 m');
    expect(formatDistance(82)).toBe('80 m');
    expect(formatDistance(0)).toBe('0 m');
  });

  it('formats 1 km and above with one decimal and a Danish comma', () => {
    expect(formatDistance(1234)).toBe('1,2 km');
    expect(formatDistance(1000)).toBe('1,0 km');
    expect(formatDistance(7570)).toBe('7,6 km');
  });
});

describe('buildGymSuggestions — empty query (browse mode)', () => {
  it('returns recent names in order, capped at 3', () => {
    const result = buildGymSuggestions({
      gyms: GYMS,
      recentNames: ['Slottet', 'Stationen', 'Svømmehallen', 'Vandtårnet'],
      position: null,
      query: '',
    });
    if (result.mode !== 'browse') throw new Error('expected browse mode');
    expect(result.recent).toEqual(['Slottet', 'Stationen', 'Svømmehallen']);
  });

  it('returns no nearby gyms when the position is unknown', () => {
    const result = buildGymSuggestions({
      gyms: GYMS,
      recentNames: [],
      position: null,
      query: '',
    });
    if (result.mode !== 'browse') throw new Error('expected browse mode');
    expect(result.nearby).toEqual([]);
  });

  it('returns the 5 nearest gyms with coordinates, sorted by distance, with labels', () => {
    const result = buildGymSuggestions({
      gyms: GYMS,
      recentNames: [],
      position: POSITION,
      query: '',
    });
    if (result.mode !== 'browse') throw new Error('expected browse mode');
    expect(result.nearby.map(g => g.name)).toEqual([
      'Frederikssund Kirke',
      'Svømmehallen',
      'Stationen',
      'Vandtårnet',
      'Slottet',
    ]);
    // Labels come straight from formatDistance(haversineMeters(...)).
    expect(result.nearby[1].distanceLabel).toBe(
      formatDistance(
        haversineMeters(POSITION, { lat: 55.841, lng: 12.061 })
      )
    );
    expect(result.nearby.every(g => g.distanceLabel.length > 0)).toBe(true);
  });

  it('excludes gyms already in recent from nearby (case-insensitively)', () => {
    const result = buildGymSuggestions({
      gyms: GYMS,
      recentNames: ['frederikssund kirke'],
      position: POSITION,
      query: '',
    });
    if (result.mode !== 'browse') throw new Error('expected browse mode');
    expect(result.nearby.map(g => g.name)).toEqual([
      'Svømmehallen',
      'Stationen',
      'Vandtårnet',
      'Slottet',
      'Slangerup Kirke',
    ]);
  });

  it('treats a query that trims below 2 characters as browse mode', () => {
    const result = buildGymSuggestions({
      gyms: GYMS,
      recentNames: ['Slottet'],
      position: null,
      query: ' a ',
    });
    expect(result.mode).toBe('browse');
  });
});

describe('buildGymSuggestions — typed query (search mode)', () => {
  it('filters case-insensitively and sorts alphabetically without a position', () => {
    const result = buildGymSuggestions({
      gyms: GYMS,
      recentNames: [],
      position: null,
      query: 'AN',
    });
    if (result.mode !== 'search') throw new Error('expected search mode');
    expect(result.matches.map(m => m.name)).toEqual([
      'Anonym Statue',
      'Slangerup Kirke',
      'Vandposten',
      'Vandtårnet',
    ]);
    expect(result.matches.every(m => m.distanceLabel === undefined)).toBe(true);
  });

  it('sorts matches by distance with a position; coordless gyms last, alphabetical', () => {
    const result = buildGymSuggestions({
      gyms: GYMS,
      recentNames: [],
      position: POSITION,
      query: 'an',
    });
    if (result.mode !== 'search') throw new Error('expected search mode');
    expect(result.matches.map(m => m.name)).toEqual([
      'Vandtårnet', // ~1.3 km
      'Slangerup Kirke', // ~7.6 km
      'Anonym Statue', // no coords — last, alphabetical
      'Vandposten',
    ]);
    expect(result.matches[0].distanceLabel).toBe(
      formatDistance(haversineMeters(POSITION, { lat: 55.83, lng: 12.07 }))
    );
    expect(result.matches[2].distanceLabel).toBeUndefined();
    expect(result.matches[3].distanceLabel).toBeUndefined();
  });

  it('trims the query before filtering', () => {
    const result = buildGymSuggestions({
      gyms: GYMS,
      recentNames: [],
      position: null,
      query: '  kirke ',
    });
    if (result.mode !== 'search') throw new Error('expected search mode');
    expect(result.matches.map(m => m.name)).toEqual([
      'Frederikssund Kirke',
      'Slangerup Kirke',
    ]);
  });

  it('returns no matches when nothing fits the query', () => {
    const result = buildGymSuggestions({
      gyms: GYMS,
      recentNames: [],
      position: POSITION,
      query: 'zzz',
    });
    if (result.mode !== 'search') throw new Error('expected search mode');
    expect(result.matches).toEqual([]);
  });
});
