// Builds src/data/boundaries/marinduque-{municipalities,barangays}.geojson from faeldon/philippines-json-maps.
//
// Source: release v1.1.1 (PSGC 2026-3q), topojson-hires.zip (10 % of the vertices), MIT; the boundaries are
// CC BY-IGO by NAMRIA and PSA through OCHA's COD-AB. Unzip it and pass the folder:
//   node scripts/build-boundaries.js <unzipped>/topojson
// Reads provdists/hires/municities-provdist-1704000000.topo.0.1.json and
// municities/hires/bgysubmuns-municity-17040{01..06}000.topo.0.1.json.
// Output is already ≤ 300 KB per file at this resolution, so there is no extra simplification pass.
import fs from 'node:fs';
import path from 'node:path';
import polylabel from 'polylabel';

const PROVINCE = 1704000000;
// Source spelling → our marinduque-locations.json spelling.
const ALIASES = { 'Mataas Na Bayan': 'Mataas na Bayan', Pinggan: 'Pingan', Kinyaman: 'Kiñaman', 'Pag-Asa Pob.': 'Pag-asa Poblacion' };
const ourName = (name) => ALIASES[name] ?? name.replace(/ Pob\.$/, ' Poblacion');

const round = (n) => Math.round(n * 1e5) / 1e5; // ~1 m

/** TopoJSON (quantized, delta-encoded arcs) → GeoJSON features. */
function decode(file) {
  const topo = JSON.parse(fs.readFileSync(file, 'utf8'));
  const [sx, sy] = topo.transform.scale;
  const [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [round(x * sx + tx), round(y * sy + ty)];
    });
  });
  const arcAt = (i) => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]);
  const ring = (ids) => ids.flatMap((i, k) => (k ? arcAt(i).slice(1) : arcAt(i)));
  const [object] = Object.values(topo.objects);
  return object.geometries.map((g) => ({
    properties: g.properties,
    geometry: g.type === 'Polygon' ? { type: 'Polygon', coordinates: g.arcs.map(ring) } : { type: 'MultiPolygon', coordinates: g.arcs.map((p) => p.map(ring)) },
  }));
}

const ringArea = (r) => Math.abs(r.reduce((a, [x1, y1], i) => { const [x2, y2] = r[(i + 1) % r.length]; return a + x1 * y2 - x2 * y1; }, 0)) / 2;

/** Pole of inaccessibility of the largest polygon: where the pin goes when the area is picked from a list. */
function label(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const largest = polygons.reduce((a, b) => (ringArea(b[0]) > ringArea(a[0]) ? b : a));
  const [lng, lat] = polylabel(largest, 0.00005);
  return [round(lng), round(lat)];
}

const bbox = (geometry) => {
  const points = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).flat(2);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

const feature = (properties, geometry) => ({ type: 'Feature', id: properties.psgc, properties: { ...properties, label: label(geometry), bbox: bbox(geometry) }, geometry });

const src = process.argv[2];
if (!src) throw new Error('Usage: node scripts/build-boundaries.js <unzipped topojson folder>');

const municipalities = decode(path.join(src, `provdists/hires/municities-provdist-${PROVINCE}.topo.0.1.json`)).map(({ properties: p, geometry }) =>
  feature({ psgc: p.adm3_psgc, municipality: p.adm3_en, barangay: null }, geometry),
);
const barangays = municipalities.flatMap((m) =>
  decode(path.join(src, `municities/hires/bgysubmuns-municity-${m.properties.psgc}.topo.0.1.json`))
    .filter(({ properties: p }) => p.geo_level === 'Bgy')
    .map(({ properties: p, geometry }) => feature({ psgc: p.adm4_psgc, municipality: m.properties.municipality, barangay: ourName(p.adm4_en) }, geometry)),
);

const out = path.resolve(import.meta.dirname, '../src/data/boundaries');
fs.mkdirSync(out, { recursive: true });
for (const [name, features] of [['municipalities', municipalities], ['barangays', barangays]]) {
  const file = path.join(out, `marinduque-${name}.geojson`);
  fs.writeFileSync(file, JSON.stringify({ type: 'FeatureCollection', source: 'faeldon/philippines-json-maps v1.1.1 (PSGC 2026-3q); boundaries CC BY-IGO NAMRIA/PSA via OCHA COD-AB', features }));
  console.log(`${file}: ${features.length} features, ${Math.round(fs.statSync(file).size / 1024)} KB`);
}
