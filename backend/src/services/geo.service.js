import { forwardGeocode, reverseGeocode } from '../clients/mapbox.client.js';
import { insideBounds } from '../constants/geo.js';
import { locate } from './boundary.service.js';
import { getLocations } from './location.service.js';

/**
 * Address fields for a dropped pin. Municipality and barangay come from the PSGC polygons (point-in-polygon);
 * Mapbox only fills the street.
 * @param {{ lat: number, lng: number }} point
 * @returns {Promise<{ municipality: string|null, barangay: string|null, street: string, postalCode: string|null, insideDeliveryArea: boolean }>}
 */
export async function reverse(point) {
  const area = locate(point);
  if (!area) return { municipality: null, barangay: null, street: '', postalCode: null, insideDeliveryArea: false };
  const places = await reverseGeocode(point.lat, point.lng).catch((error) => {
    console.warn(`[geo] Mapbox reverse geocoding failed: ${error.message}`);
    return [];
  });
  const context = places[0]?.context ?? {};
  return {
    ...area,
    street: context.address ?? context.street ?? '',
    postalCode: getLocations().find((t) => t.name === area.municipality).postalCode,
    insideDeliveryArea: true,
  };
}

const brief = ({ name, fullAddress, lat, lng }) => ({ name, fullAddress, lat, lng });

/**
 * Free-text place search for the address window, limited to Marinduque.
 * (Picking a barangay no longer geocodes: the map moves to the barangay polygon's label point.)
 * @param {{ q: string }} query
 * @returns {Promise<Array<{ name: string, fullAddress: string, lat: number, lng: number }>>}
 */
export async function search({ q }) {
  const places = await forwardGeocode(q);
  return places.filter(insideBounds).map(brief);
}
