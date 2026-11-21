import { drivingDistanceKm, forwardGeocode } from '../clients/mapbox.client.js';
import { getValkey } from '../config/valkey.js';
import { insideBounds } from '../constants/geo.js';
import { AppError } from '../utils/AppError.js';
import { etaWindow } from '../utils/businessDays.js';
import { feeForDistance, haversineKm } from '../utils/deliveryFee.js';
import { getLocations } from './location.service.js';
import { getSetting } from './setting.service.js';

const CACHE_TTL_SEC = 24 * 3600;

export const outsideDeliveryArea = () =>
  new AppError(422, 'That address is outside our delivery area. We deliver anywhere in Marinduque.', { code: 'OUTSIDE_DELIVERY_AREA' });
const needsPin = () =>
  new AppError(422, "We couldn't find this address on the map. Drop a pin so we can work out the delivery fee.", { code: 'ADDRESS_NEEDS_PIN' });

async function cached(key, compute) {
  const valkey = getValkey();
  const hit = await valkey.get(key).catch(() => null);
  if (hit) return JSON.parse(hit);
  const value = await compute();
  if (value) valkey.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SEC).catch(() => {});
  return value;
}

/** Road distance from Kaluppa; Mapbox results are cached 24 h, the straight-line fallback is not. */
async function roadDistance(origin, point, roadFactor) {
  const key = `quote:${point.lat.toFixed(4)}:${point.lng.toFixed(4)}`;
  let fallback;
  const value = await cached(key, async () => {
    try {
      return { distanceKm: await drivingDistanceKm(origin, point), distanceSource: 'mapbox' };
    } catch (error) {
      console.warn(`[delivery-quote] Mapbox directions failed, using straight-line distance: ${error.message}`);
      fallback = { distanceKm: haversineKm(origin, point) * roadFactor, distanceSource: 'fallback' };
      return null;
    }
  });
  return value ?? fallback;
}

/**
 * Delivery quote for a map point in Marinduque.
 * @param {{ lat: number, lng: number }} point
 * @param {Date} [now] the ETA is counted as if the order were confirmed at this time
 * @returns {Promise<{ distanceKm: number, feeCentavos: number, distanceSource: 'mapbox'|'fallback', eta: { from: Date, to: Date } }>}
 */
export async function quoteForPoint(point, now = new Date()) {
  if (!insideBounds(point)) throw outsideDeliveryArea();
  const [rules, eta] = await Promise.all([getSetting('delivery.fee'), getSetting('delivery.eta')]);
  const { distanceKm: raw, distanceSource } = await roadDistance(rules.origin, point, rules.roadFactorFallback);
  // The fee uses the same rounded distance the buyer sees.
  const distanceKm = Math.round(raw * 10) / 10;
  if (distanceKm > rules.maxKm) throw outsideDeliveryArea();
  return { distanceKm, feeCentavos: feeForDistance(distanceKm, rules), distanceSource, eta: etaWindow(now, eta) };
}

/** First geocoded point for a typed address, or null. Cached 24 h per query. */
const geocodeAddress = ({ street, barangay, municipality }) => {
  const query = `${street}, ${barangay}, ${municipality}, Marinduque, Philippines`;
  return cached(`geocode:${query.toLowerCase()}`, async () => {
    const places = await forwardGeocode(query).catch((error) => {
      console.warn(`[delivery-quote] Mapbox geocoding failed: ${error.message}`);
      return [];
    });
    const place = places.find(insideBounds);
    return place ? { lat: place.lat, lng: place.lng } : null;
  });
};

/**
 * Delivery quote for a saved (or about to be saved) address: its pin, else its geocoded street.
 * @param {{ municipality: string, barangay: string, street: string, location?: { coordinates: [number, number] } }} address
 * @param {Date} [now]
 */
export async function quoteForAddress(address, now) {
  if (!getLocations().some((m) => m.name === address.municipality)) throw outsideDeliveryArea();
  const coordinates = address.location?.coordinates;
  const point = coordinates?.length === 2 ? { lng: coordinates[0], lat: coordinates[1] } : await geocodeAddress(address);
  if (!point) throw needsPin();
  return quoteForPoint(point, now);
}
