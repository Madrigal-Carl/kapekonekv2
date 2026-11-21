import { env } from '../config/env.js';
import { BOUNDS } from '../constants/geo.js';

const BASE = 'https://api.mapbox.com';
const BBOX = [BOUNDS.minLng, BOUNDS.minLat, BOUNDS.maxLng, BOUNDS.maxLat].join(',');

async function getJson(path, params) {
  if (!env.MAPBOX_ACCESS_TOKEN) throw new Error('MAPBOX_ACCESS_TOKEN is not set');
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries({ ...params, access_token: env.MAPBOX_ACCESS_TOKEN })) url.searchParams.set(key, String(value));
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Mapbox ${path.split('/')[1]} responded ${res.status}`);
  return res.json();
}

/** A Geocoding v6 feature as `{ name, fullAddress, lat, lng, context: { place, locality, neighborhood, street, address, … } }` (names only). */
const toPlace = ({ geometry, properties }) => ({
  name: properties.name,
  fullAddress: properties.full_address ?? properties.place_formatted ?? properties.name,
  lat: geometry.coordinates[1],
  lng: geometry.coordinates[0],
  context: Object.fromEntries(Object.entries(properties.context ?? {}).map(([type, value]) => [type, value?.name])),
});

/**
 * Driving distance by road (Directions API).
 * @param {{ lat: number, lng: number }} from
 * @param {{ lat: number, lng: number }} to
 * @returns {Promise<number>} km
 */
export async function drivingDistanceKm(from, to) {
  const data = await getJson(`/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}`, { overview: 'false' });
  const meters = data.routes?.[0]?.distance;
  if (meters == null) throw new Error('Mapbox found no driving route');
  return meters / 1000;
}

/** Places at a point, most specific first. */
export async function reverseGeocode(lat, lng) {
  const data = await getJson('/search/geocode/v6/reverse', { latitude: lat, longitude: lng, country: 'ph' });
  return (data.features ?? []).map(toPlace);
}

/** Up to 5 places matching `query`, limited to the Marinduque bounding box. */
export async function forwardGeocode(query) {
  const data = await getJson('/search/geocode/v6/forward', { q: query, country: 'ph', bbox: BBOX, limit: 5 });
  return (data.features ?? []).map(toPlace);
}
