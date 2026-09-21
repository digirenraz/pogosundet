import { describe, it, expect } from 'vitest';
import { nearestGymName, NEAREST_GYM_MAX_METERS } from './nearest';
import type { Gym } from '@/lib/gyms/suggestions';

// Real-ish Frederikssund coordinates.
const KALVOEEN: Gym = { name: 'Kalvøen', lat: 55.8331, lng: 12.0431 };
const SLOTTET: Gym = { name: 'Jægerspris Slot', lat: 55.8592, lng: 11.9852 };
const NAMELESS: Gym = { name: 'Auto-learned gym', lat: null, lng: null };

describe('nearestGymName', () => {
  it('picks the closest gym with coordinates', () => {
    const nearKalvoeen = { lat: 55.8333, lng: 12.0435 };
    expect(nearestGymName(nearKalvoeen, [SLOTTET, KALVOEEN])).toBe('Kalvøen');
  });

  it('ignores gyms with no coordinates', () => {
    const nearKalvoeen = { lat: 55.8333, lng: 12.0435 };
    expect(nearestGymName(nearKalvoeen, [NAMELESS, KALVOEEN])).toBe('Kalvøen');
    expect(nearestGymName(nearKalvoeen, [NAMELESS])).toBeNull();
  });

  it('returns null when nothing is close enough to describe the position', () => {
    // Copenhagen — every Frederikssund gym is tens of km away, so naming one
    // would be actively misleading rather than merely imprecise.
    expect(nearestGymName({ lat: 55.6761, lng: 12.5683 }, [KALVOEEN, SLOTTET])).toBeNull();
  });

  it('returns null for an empty gym list', () => {
    expect(nearestGymName({ lat: 55.8333, lng: 12.0435 }, [])).toBeNull();
  });

  it('uses a threshold that still covers a short walk', () => {
    expect(NEAREST_GYM_MAX_METERS).toBeGreaterThanOrEqual(500);
  });
});
