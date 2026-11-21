import RedisMock from 'ioredis-mock';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = { db: true, valkey: new RedisMock() };
vi.mock('../src/config/db.js', () => ({ isDbConnected: () => state.db }));
vi.mock('../src/config/valkey.js', () => ({ getValkey: () => state.valkey }));

const { default: app } = await import('../src/app.js');

beforeEach(() => {
  state.db = true;
  state.valkey = new RedisMock();
});

describe('GET /api/health', () => {
  it('returns ok when Mongo and Valkey are up', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok', checks: { mongo: 'up', valkey: 'up' } } });
  });

  it('returns 503 when Mongo is down', async () => {
    state.db = false;
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.data).toEqual({ status: 'degraded', checks: { mongo: 'down', valkey: 'up' } });
  });

  it('returns 503 when Valkey does not answer', async () => {
    state.valkey = { ping: () => Promise.reject(new Error('ECONNREFUSED')) };
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.data.checks.valkey).toBe('down');
  });
});
