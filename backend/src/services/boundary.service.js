import fs from 'node:fs';
import { insideBounds } from '../constants/geo.js';

// PSGC polygons for Marinduque (built by scripts/build-boundaries.js). Properties: { psgc, municipality, barangay, label, bbox }.
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../data/boundaries/marinduque-${name}.geojson`, import.meta.url), 'utf8'));
const MUNICIPALITIES = read('municipalities').features;
const BARANGAYS = read('barangays').features;

// The shapes keep 10 % of the surveyed vertices, so a pin on the shore can land a few metres "in the sea".
const COAST_TOLERANCE_KM = 0.2;
const KM_PER_DEG = 111.32;

const polygonsOf = (geometry) => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates);

/** Ray casting: is (x, y) inside the ring? */
function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** @param {{ geometry: object }} feature @param {{ lat: number, lng: number }} point */
export const contains = (feature, { lat, lng }) =>
  polygonsOf(feature.geometry).some(([outer, ...holes]) => inRing(outer, lng, lat) && !holes.some((h) => inRing(h, lng, lat)));

/** Shortest distance (km) from the point to the feature's edges, on a local flat projection. */
function edgeDistanceKm(feature, { lat, lng }) {
  const kx = KM_PER_DEG * Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (const polygon of polygonsOf(feature.geometry)) {
    for (const ring of polygon) {
      for (let i = 1; i < ring.length; i++) {
        const ax = (ring[i - 1][0] - lng) * kx;
        const ay = (ring[i - 1][1] - lat) * KM_PER_DEG;
        const bx = (ring[i][0] - lng) * kx;
        const by = (ring[i][1] - lat) * KM_PER_DEG;
        const dx = bx - ax;
        const dy = by - ay;
        const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
      }
    }
  }
  return best;
}

const nearBox = ({ properties: { bbox } }, { lat, lng }, marginDeg) =>
  lng >= bbox[0] - marginDeg && lng <= bbox[2] + marginDeg && lat >= bbox[1] - marginDeg && lat <= bbox[3] + marginDeg;

/** The feature containing the point, else the nearest one within `maxKm`. */
function find(features, point, maxKm) {
  const margin = maxKm / KM_PER_DEG / 0.9;
  const candidates = Number.isFinite(maxKm) ? features.filter((f) => nearBox(f, point, margin)) : features;
  const hit = candidates.find((f) => nearBox(f, point, 0) && contains(f, point));
  if (hit || !candidates.length) return hit ?? null;
  const [nearest] = candidates.map((f) => [f, edgeDistanceKm(f, point)]).sort((a, b) => a[1] - b[1]);
  return nearest[1] <= maxKm ? nearest[0] : null;
}

/**
 * Municipality and barangay a point falls in (point-in-polygon), or null outside Marinduque.
 * @param {{ lat: number, lng: number }} point
 * @returns {{ municipality: string, barangay: string } | null}
 */
export function locate(point) {
  if (!insideBounds(point)) return null;
  const town = find(MUNICIPALITIES, point, COAST_TOLERANCE_KM);
  if (!town) return null;
  const { municipality } = town.properties;
  // Barangays tile their municipality, so a gap between simplified shapes goes to the nearest one.
  const barangay = find(BARANGAYS.filter((b) => b.properties.municipality === municipality), point, Infinity);
  return { municipality, barangay: barangay.properties.barangay };
}

/**
 * Where a pin goes for an area picked from a list: its pole of inaccessibility (precomputed with polylabel).
 * @returns {{ lat: number, lng: number }}
 */
export function labelPoint(municipality, barangay) {
  const area = barangay
    ? BARANGAYS.find((b) => b.properties.municipality === municipality && b.properties.barangay === barangay)
    : MUNICIPALITIES.find((m) => m.properties.municipality === municipality);
  const [lng, lat] = area.properties.label;
  return { lat, lng };
}

/** Is the point on Marinduque (the union of its municipalities, with a small shore tolerance)? */
export const insideMarinduque = (point) => locate(point) !== null;

/**
 * Boundary polygons for the maps.
 * @param {{ level: 'municipality'|'barangay', municipality?: string }} query
 * @returns {{ type: 'FeatureCollection', features: object[] }}
 */
export function getBoundaries({ level, municipality }) {
  const features = level === 'municipality' ? MUNICIPALITIES : BARANGAYS.filter((b) => !municipality || b.properties.municipality === municipality);
  return { type: 'FeatureCollection', features };
}
