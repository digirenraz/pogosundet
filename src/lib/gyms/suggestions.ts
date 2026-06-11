// Pure ranking/grouping logic for the raid form's gym suggestions (no I/O).
// The GymSearch component feeds it the cached `gyms` rows, the user's recent
// gym names (their last raids) and an optional browser-geolocation position,
// and renders whatever comes back:
//
// - Empty/short query → "browse" mode: the user's recent gyms plus the
//   nearest gyms by distance (when a position is known).
// - Query of ≥2 chars → "search" mode: the existing case-insensitive filter,
//   distance-sorted (and labelled) when a position is known.
//
// The position never leaves the browser — it is only used here, transiently,
// to sort and label suggestions (GDPR: never stored, never sent to a server).

import type { GymLocation } from './maps';

// One row from the community `gyms` table. lat/lng are null for auto-learned
// gyms (name-only inserts from posted raids) — every consumer must tolerate
// missing coordinates.
export interface Gym {
  name: string;
  lat: number | null;
  lng: number | null;
}

export interface NearbyGym {
  name: string;
  distanceLabel: string;
}

export interface GymMatch {
  name: string;
  /** Only set when the gym has coordinates AND the position is known. */
  distanceLabel?: string;
}

export type GymSuggestions =
  /** Empty/short query: recent gyms + nearest gyms (groups may be empty). */
  | { mode: 'browse'; recent: string[]; nearby: NearbyGym[] }
  /** Query of ≥2 chars: filtered matches, distance-sorted when possible. */
  | { mode: 'search'; matches: GymMatch[] };

const EARTH_RADIUS_METERS = 6_371_000; // mean Earth radius

const RECENT_LIMIT = 3;
const NEARBY_LIMIT = 5;

// Great-circle distance between two lat/lng points, in meters (haversine).
// Plenty accurate at municipality scale.
export function haversineMeters(a: GymLocation, b: GymLocation): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

// Human-friendly distance label: below 1 km in meters rounded to the nearest
// 10 ("350 m"), otherwise in km with one decimal and a Danish comma ("1,2 km").
// Not an i18n key by design — it's a number format, identical in da and en.
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters / 10) * 10} m`;
  }
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

interface BuildArgs {
  gyms: Gym[];
  /** The user's most recent gym names, newest first (already deduped). */
  recentNames: string[];
  /** Browser geolocation, or null when not (yet) available. */
  position: GymLocation | null;
  query: string;
}

export function buildGymSuggestions({
  gyms,
  recentNames,
  position,
  query,
}: BuildArgs): GymSuggestions {
  const needle = query.trim().toLowerCase();

  if (needle.length < 2) {
    const recent = recentNames.slice(0, RECENT_LIMIT);
    const recentKeys = new Set(recent.map(n => n.toLowerCase()));

    const nearby: NearbyGym[] = position
      ? gyms
          .filter(
            (g): g is Gym & GymLocation =>
              g.lat !== null && g.lng !== null && !recentKeys.has(g.name.toLowerCase())
          )
          .map(g => ({ name: g.name, meters: haversineMeters(position, g) }))
          .sort((a, b) => a.meters - b.meters)
          .slice(0, NEARBY_LIMIT)
          .map(g => ({ name: g.name, distanceLabel: formatDistance(g.meters) }))
      : [];

    return { mode: 'browse', recent, nearby };
  }

  const filtered = gyms.filter(g => g.name.toLowerCase().includes(needle));

  // Distance when computable (gym has coords AND we have a position).
  const withMeters = filtered.map(g => ({
    name: g.name,
    meters:
      position && g.lat !== null && g.lng !== null
        ? haversineMeters(position, { lat: g.lat, lng: g.lng })
        : null,
  }));

  // Known distances first (ascending), then coordless/no-position gyms
  // alphabetically. Without a position every distance is null, so the whole
  // list is alphabetical — the pre-existing behaviour.
  withMeters.sort((a, b) => {
    if (a.meters !== null && b.meters !== null) return a.meters - b.meters;
    if (a.meters !== null) return -1;
    if (b.meters !== null) return 1;
    return a.name.localeCompare(b.name, 'da');
  });

  const matches: GymMatch[] = withMeters.map(g =>
    g.meters !== null
      ? { name: g.name, distanceLabel: formatDistance(g.meters) }
      : { name: g.name }
  );

  return { mode: 'search', matches };
}
