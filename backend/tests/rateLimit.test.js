import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {};
vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  state.redis = new RedisMock();
  return { getValkey: () => state.valkey };
});

const { rateLimit } = await import('../src/middlewares/rateLimit.middleware.js');
const { errorHandler } = await import('../src/middlewares/error.middleware.js');

const app = express();
app.get('/limited', rateLimit({ name: 'test', limit: 2, windowSec: 60 }), (_req, res) => res.json({ ok: true }));
app.use(errorHandler);

beforeEach(async () => {
  state.valkey = state.redis;
  await state.redis.flushall();
});

describe('rateLimit', () => {
  it('returns 429 with Retry-After after the limit', async () => {
    expect((await request(app).get('/limited')).status).toBe(200);
    expect((await request(app).get('/limited')).status).toBe(200);
    const res = await request(app).get('/limited');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('fails open when Valkey is unreachable', async () => {
    state.valkey = { multi: () => ({ incr: () => ({ ttl: () => ({ exec: () => Promise.reject(new Error('down')) }) }) }) };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (let i = 0; i < 4; i += 1) expect((await request(app).get('/limited')).status).toBe(200);
    spy.mockRestore();
  });
});
