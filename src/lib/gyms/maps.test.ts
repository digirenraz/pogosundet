import { describe, it, expect } from 'vitest';
import { buildMapsUrl } from './maps';

describe('buildMapsUrl', () => {
  it('builds a coordinate URL when a location is provided', () => {
    expect(buildMapsUrl('Frederikssund Kirke', { lat: 55.8396, lng: 12.0689 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=55.8396,12.0689'
    );
  });

  it('preserves negative and high-precision coordinates verbatim', () => {
    expect(buildMapsUrl('Somewhere', { lat: -33.8567844, lng: 151.2152967 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=-33.8567844,151.2152967'
    );
  });

  it('falls back to a name search with the Frederikssund Danmark suffix when location is null', () => {
    expect(buildMapsUrl('Slottet', null)).toBe(
      'https://www.google.com/maps/search/?api=1&query=Slottet%20Frederikssund%20Danmark'
    );
  });

  it("URL-encodes special characters like ' in the fallback name", () => {
    expect(buildMapsUrl("Bager'ens Skilt", null)).toBe(
      "https://www.google.com/maps/search/?api=1&query=Bager'ens%20Skilt%20Frederikssund%20Danmark"
    );
  });

  it('URL-encodes Danish letters (æøå) in the fallback name', () => {
    expect(buildMapsUrl('Græse Å', null)).toBe(
      'https://www.google.com/maps/search/?api=1&query=Gr%C3%A6se%20%C3%85%20Frederikssund%20Danmark'
    );
  });

  it('URL-encodes characters with reserved URL meaning (& ? #) in the fallback name', () => {
    expect(buildMapsUrl('Hus & Have #2?', null)).toBe(
      'https://www.google.com/maps/search/?api=1&query=Hus%20%26%20Have%20%232%3F%20Frederikssund%20Danmark'
    );
  });
});
