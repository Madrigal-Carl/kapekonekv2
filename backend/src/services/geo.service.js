import { forwardGeocode, reverseGeocode } from '../clients/mapbox.client.js';
import { getValkey } from '../config/valkey.js';
import { insideBounds, MUNICIPALITY_CENTERS } from '../constants/geo.js';
import { haversineKm } from '../utils/deliveryFee.js';
import { getLocations } from './location.service.js';

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const nearestTown = (point) =>
  getLocations().reduce((best, town) => (haversineKm(point, MUNICIPALITY_CENTERS[town.name]) < haversineKm(point, MUNICIPALITY_CENTERS[best.name]) ? town : best));

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

const BARANGAY_TTL_SEC = 7 * 24 * 3600;
const brief = ({ name, fullAddress, lat, lng }) => ({ name, fullAddress, lat, lng });

/**
 * Where a barangay is: the nearest Mapbox result (biased to the town centre) that actually names it.
 * Mapbox often knows only the town; that counts as not found (`[]`), so the map stays at town zoom.
 * Cached 7 days in Valkey (misses too), keyed `geo:brgy:<municipality>:<barangay>`.
 */
async function findBarangay(municipality, barangay) {
  const key = `geo:brgy:${municipality}:${barangay}`;
  const valkey = getValkey();
  const hit = await valkey.get(key).catch(() => null);
  if (hit) return JSON.parse(hit);
  const center = MUNICIPALITY_CENTERS[municipality];
  const places = await forwardGeocode(`${barangay}, ${municipality}, Marinduque, Philippines`, { proximity: center });
  const wanted = norm(barangay);
  const named = places
    .filter((p) => insideBounds(p) && [p.name, ...Object.values(p.context ?? {})].some((n) => n && norm(n) === wanted))
    .sort((a, b) => haversineKm(a, center) - haversineKm(b, center));
  const result = named.slice(0, 1).map(brief);
  valkey.set(key, JSON.stringify(result), 'EX', BARANGAY_TTL_SEC).catch(() => {});
  return result;
}

/**
 * Place search for the address window, limited to Marinduque: free text (`q`) or one barangay of a municipality.
 * @param {{ q?: string, municipality?: string, barangay?: string }} query
 * @returns {Promise<Array<{ name: string, fullAddress: string, lat: number, lng: number }>>}
 */
export async function search({ q, municipality, barangay }) {
  if (barangay) return findBarangay(municipality, barangay);
  const places = await forwardGeocode(q);
  return places.filter(insideBounds).map(brief);
}
