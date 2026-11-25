// Farm: only for people with farms (farms.manage), checked in the address service.
export const ADDRESS_LABELS = ['Home', 'Work', 'Farm', 'Other'];

/** Marinduque delivery bounds (PRODUCT-SPEC §9). */
export const BOUNDS = { minLat: 13.15, maxLat: 13.62, minLng: 121.8, maxLng: 122.2 };

/** @param {{ lat: number, lng: number }} point */
export const insideBounds = ({ lat, lng }) =>
  lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng;

/**
 * Municipality (town) centres: the address map flies here when a municipality is picked, a pin snaps to the
 * nearest one when Mapbox doesn't name the town, and barangay lookups are biased toward it. Sent with `/locations`.
 */
export const MUNICIPALITY_CENTERS = {
  Boac: { lat: 13.4467, lng: 121.8406 },
  Mogpog: { lat: 13.4744, lng: 121.8619 },
  'Santa Cruz': { lat: 13.4778, lng: 122.03 },
  Torrijos: { lat: 13.3189, lng: 122.0819 },
  Buenavista: { lat: 13.2567, lng: 121.9419 },
  Gasan: { lat: 13.3247, lng: 121.8461 },
};
