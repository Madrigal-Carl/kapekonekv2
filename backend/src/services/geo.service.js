import { forwardGeocode, reverseGeocode } from '../clients/mapbox.client.js';
import { insideBounds, TOWN_CENTERS } from '../constants/geo.js';
import { haversineKm } from '../utils/deliveryFee.js';
import { getLocations } from './location.service.js';

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const nearestTown = (point) =>
  getLocations().reduce((best, town) => (haversineKm(point, TOWN_CENTERS[town.name]) < haversineKm(point, TOWN_CENTERS[best.name]) ? town : best));

/**
 * Address fields for a dropped pin. The municipality is matched by name, else the nearest town;
 * the barangay is matched by name only (null when Mapbox doesn't name one of ours).
 * @param {{ lat: number, lng: number }} point
 * @returns {Promise<{ municipality: string|null, barangay: string|null, street: string, postalCode: string|null, insideDeliveryArea: boolean }>}
 */
export async function reverse(point) {
  if (!insideBounds(point)) return { municipality: null, barangay: null, street: '', postalCode: null, insideDeliveryArea: false };
  const places = await reverseGeocode(point.lat, point.lng).catch((error) => {
    console.warn(`[geo] Mapbox reverse geocoding failed: ${error.message}`);
    return [];
  });
  const names = new Set(places.flatMap((p) => [p.name, ...Object.values(p.context ?? {})]).filter(Boolean).map(norm));
  const town = getLocations().find((t) => names.has(norm(t.name))) ?? nearestTown(point);
  const context = places[0]?.context ?? {};
  return {
    municipality: town.name,
    barangay: town.barangays.find((b) => names.has(norm(b))) ?? null,
    street: context.address ?? context.street ?? '',
    postalCode: town.postalCode,
    insideDeliveryArea: true,
  };
}

/**
 * Place search for the address window, limited to Marinduque.
 * @param {string} query
 * @returns {Promise<Array<{ name: string, fullAddress: string, lat: number, lng: number }>>}
 */
export async function search(query) {
  const places = await forwardGeocode(query);
  return places.filter(insideBounds).map(({ name, fullAddress, lat, lng }) => ({ name, fullAddress, lat, lng }));
}
