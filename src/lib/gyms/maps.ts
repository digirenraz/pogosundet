// Builds the URL the raid detail's "Vis på kort" button opens. Pure function,
// no I/O — the coordinates (if any) come from `getGymLocation` in
// `server-helpers.ts`.
//
// Uses Google's documented universal Maps URL form
// (https://developers.google.com/maps/documentation/urls/get-started):
// `?api=1&query=...` opens the native Google Maps app when installed
// (Android/iOS) and the browser otherwise.

export interface GymLocation {
  lat: number;
  lng: number;
}

// With coordinates: drop a pin on the exact spot. Without: fall back to the
// original name search, scoped with "Frederikssund Danmark" so Maps guesses
// the right town (the pre-coordinates behaviour, kept for auto-learned
// name-only gyms and gyms not in the table at all).
export function buildMapsUrl(gymName: string, location: GymLocation | null): string {
  const query = location
    ? `${location.lat},${location.lng}`
    : encodeURIComponent(`${gymName} Frederikssund Danmark`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
