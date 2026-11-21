/**
 * Delivery fee for a road distance (PRODUCT-SPEC §3): base fee for the first `baseKm`, `perKm` after, rounded up.
 * @param {number} distanceKm
 * @param {{ baseFeeCentavos: number, baseKm: number, perKmCentavos: number, roundUpToCentavos: number }} rules
 * @returns {number} centavos
 */
export function feeForDistance(distanceKm, { baseFeeCentavos, baseKm, perKmCentavos, roundUpToCentavos }) {
  const raw = baseFeeCentavos + Math.max(0, distanceKm - baseKm) * perKmCentavos;
  return Math.ceil(Math.round(raw) / roundUpToCentavos) * roundUpToCentavos;
}

/**
 * Straight-line distance in km (the fallback when Mapbox has no route).
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 */
export function haversineKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
