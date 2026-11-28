import fs from 'node:fs';
import { createRequire } from 'node:module';
import RedisMock from 'ioredis-mock';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/valkey.js', () => ({ getValkey: () => new RedisMock() }));

const { default: app } = await import('../src/app.js');
const { getBoundaries, insideMarinduque, labelPoint, locate } = await import('../src/services/boundary.service.js');
const locations = createRequire(import.meta.url)('../src/data/marinduque-locations.json');

const file = (name) => new URL(`../src/data/boundaries/marinduque-${name}.geojson`, import.meta.url);

describe('boundary data', () => {
  it('every municipality and barangay in our list matches exactly one feature', () => {
    const towns = getBoundaries({ level: 'municipality' }).features;
    expect(towns).toHaveLength(6);
    let total = 0;
    for (const m of locations.municipalities) {
      expect(towns.filter((f) => f.properties.municipality === m.name)).toHaveLength(1);
      const features = getBoundaries({ level: 'barangay', municipality: m.name }).features;
      expect(features).toHaveLength(m.barangays.length);
      for (const name of m.barangays) expect(features.filter((f) => f.properties.barangay === name), `${m.name} / ${name}`).toHaveLength(1);
      total += features.length;
    }
    expect(total).toBe(218);
  });

  it('each file stays at or under 300 KB', () => {
    for (const name of ['municipalities', 'barangays']) expect(fs.statSync(file(name)).size).toBeLessThanOrEqual(300 * 1024);
  });

  it('each label point (the pin for a picked area) lies inside its own area', () => {
    for (const m of locations.municipalities) {
      for (const b of m.barangays) expect(locate(labelPoint(m.name, b)), `${m.name} / ${b}`).toEqual({ municipality: m.name, barangay: b });
    }
  });

  it('point-in-polygon: Pantayin is in Santa Cruz; the sea inside the old box is outside', () => {
    expect(locate({ lat: 13.44545, lng: 122.05866 })).toEqual({ municipality: 'Santa Cruz', barangay: 'Pantayin' });
    expect(insideMarinduque({ lat: 13.6, lng: 121.85 })).toBe(false);
    expect(insideMarinduque({ lat: 14.6, lng: 121 })).toBe(false);
  });
});

describe('GET /api/locations/boundaries', () => {
  it('returns the municipalities, public and cached for a week with an ETag', async () => {
    const res = await request(app).get('/api/locations/boundaries?level=municipality');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=604800');
    expect(res.headers.etag).toBeTruthy();
    expect(res.body.data.type).toBe('FeatureCollection');
    expect(res.body.data.features).toHaveLength(6);
    const boac = res.body.data.features.find((f) => f.properties.municipality === 'Boac');
    expect(boac).toMatchObject({ type: 'Feature', id: 1704001000, properties: { psgc: 1704001000, municipality: 'Boac', barangay: null } });
    expect(boac.properties.label).toHaveLength(2);
    expect(boac.properties.bbox).toHaveLength(4);
    expect(['Polygon', 'MultiPolygon']).toContain(boac.geometry.type);

    const again = await request(app).get('/api/locations/boundaries?level=municipality').set('If-None-Match', res.headers.etag);
    expect(again.status).toBe(304);
  });

  it('returns one municipality’s barangays', async () => {
    const res = await request(app).get('/api/locations/boundaries?level=barangay&municipality=Boac');
    expect(res.status).toBe(200);
    expect(res.body.data.features).toHaveLength(61);
    expect(res.body.data.features.every((f) => f.properties.municipality === 'Boac' && f.properties.barangay)).toBe(true);
  });

  it('rejects a missing or unknown municipality for barangays, and an unknown level', async () => {
    expect((await request(app).get('/api/locations/boundaries?level=barangay')).body.code).toBe('VALIDATION_ERROR');
    expect((await request(app).get('/api/locations/boundaries?level=barangay&municipality=Lucena')).status).toBe(400);
    expect((await request(app).get('/api/locations/boundaries?level=province')).status).toBe(400);
  });
});
