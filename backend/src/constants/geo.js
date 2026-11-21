/** Marinduque delivery bounds (PRODUCT-SPEC §9). */
export const BOUNDS = { minLat: 13.15, maxLat: 13.62, minLng: 121.8, maxLng: 122.2 };

/** @param {{ lat: number, lng: number }} point */
export const insideBounds = ({ lat, lng }) =>
  lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng;

/** Town centres, used to snap a pin to the nearest municipality when Mapbox doesn't name one. */
export const TOWN_CENTERS = {
  Boac: { lat: 13.4467, lng: 121.8406 },
  Mogpog: { lat: 13.4744, lng: 121.8619 },
  'Santa Cruz': { lat: 13.4778, lng: 122.03 },
  Torrijos: { lat: 13.3189, lng: 122.0819 },
  Buenavista: { lat: 13.2567, lng: 121.9419 },
  Gasan: { lat: 13.3247, lng: 121.8461 },
};
