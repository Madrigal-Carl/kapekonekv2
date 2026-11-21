import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/orderExpiry.service.js', () => ({ runOrderExpiry: vi.fn(async () => ({ expired: 0 })) }));

const { default: app } = await import('../src/app.js');
const { runOrderExpiry } = await import('../src/services/orderExpiry.service.js');

describe('POST /api/cron/expire-orders', () => {
  it('refuses a missing secret', async () => {
    const res = await request(app).post('/api/cron/expire-orders');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('refuses a wrong secret', async () => {
    const res = await request(app).post('/api/cron/expire-orders').set('x-cron-secret', 'wrong');
    expect(res.status).toBe(401);
    expect(runOrderExpiry).not.toHaveBeenCalled();
  });

  it('runs the expiry sweep with the right secret', async () => {
    const res = await request(app).post('/api/cron/expire-orders').set('x-cron-secret', process.env.CRON_SECRET);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { expired: 0 } });
    expect(runOrderExpiry).toHaveBeenCalledOnce();
  });
});
