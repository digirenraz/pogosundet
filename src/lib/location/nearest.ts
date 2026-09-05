// Turns a raw coordinate into a human anchor ("ved Kalvøen").
//
// Pure, and deliberately client-side only: the label is derived from the
// already-cached gyms list at render time and is NEVER stored alongside the
// position. The database keeps coordinates and nothing else.
//
// A coordinate on its own is unreadable — "55.83971, 12.06855" tells nobody
// whether it is worth walking over. Naming the nearest known gym is what makes
// the list scannable.

import { haversineMeters } from '@/lib/gyms/suggestions';
import type { Gym } from '@/lib/gyms/suggestions';
import type { GymLocation } from '@/lib/gyms/maps';

/**
 * Beyond this, the nearest gym stops being a useful description of where
 * someone is — better to show nothing than to say "ved Kalvøen" about a person
 * two kilometres away from it.
 */
export const NEAREST_GYM_MAX_METERS = 600;

/** Name of the nearest gym with coordinates, or null if none is close enough. */
export function nearestGymName(position: GymLocation, gyms: Gym[]): string | null {
  let best: { name: string; meters: number } | null = null;

  for (const gym of gyms) {
    if (typeof gym.lat !== 'number' || typeof gym.lng !== 'number') continue;
    const meters = haversineMeters(position, { lat: gym.lat, lng: gym.lng });
    if (best === null || meters < best.meters) {
      best = { name: gym.name, meters };
    }
  }

  if (best === null || best.meters > NEAREST_GYM_MAX_METERS) return null;
  return best.name;
}
