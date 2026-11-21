import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedCatalogFixture } from './helpers/catalog.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { makeOrder } from './helpers/orders.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async () => {}) }));
vi.mock('../src/sockets/realtime.js', () => ({ realtime: { toUser: vi.fn() } }));

const { realtime } = await import('../src/sockets/realtime.js');
const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { Notification, User } = await import('../src/models/index.js');

async function signedIn(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: email, password: 'Password123!' }).expect(200);
  return agent;
}

let products;
let kaluppa;
let buyer;
let buyerId;

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  ({ products } = await seedCatalogFixture());
  kaluppa = await signedIn('kaluppa@kapekonek.test');
  buyer = await signedIn('buyer@kapekonek.test');
  buyerId = (await User.findOne({ email: 'buyer@kapekonek.test' }).lean())._id;
});
afterAll(stopMemoryDb);

describe('notifications', () => {
  it('a status change stores a notification, pushes it and emits order:updated', async () => {
    const order = await makeOrder(products, { status: 'pending' });
    realtime.toUser.mockClear();
    await kaluppa.patch(`/api/orders/${order._id}/status`).send({ status: 'reserved' }).expect(200);

    const events = realtime.toUser.mock.calls.filter(([id]) => String(id) === String(buyerId)).map(([, event]) => event);
    expect(events).toEqual(expect.arrayContaining(['notification:new', 'order:updated']));
    const res = await buyer.get('/api/notifications/unread-count').expect(200);
    expect(res.body.data).toEqual({ count: 1 });
  });

  it('lists newest first with a cursor', async () => {
    await Notification.insertMany(
      Array.from({ length: 4 }, (_, i) => ({ user: buyerId, type: 'system', title: `System ${i}`, createdAt: new Date(Date.now() - (i + 1) * 60_000) })),
    );
    const first = await buyer.get('/api/notifications?limit=3').expect(200);
    expect(first.body.data).toHaveLength(3);
    expect(first.body.data[0].title).toMatch(/confirmed/);
    expect(first.body.meta.hasMore).toBe(true);
    const next = await buyer.get(`/api/notifications?limit=3&cursor=${first.body.meta.nextCursor}`).expect(200);
    expect(next.body.data.map((n) => n.title)).toEqual(['System 2', 'System 3']);
    expect(next.body.meta.hasMore).toBe(false);
  });

  it('marks one as read, then all; the unread count follows', async () => {
    const [latest] = (await buyer.get('/api/notifications?limit=1')).body.data;
    const read = await buyer.patch(`/api/notifications/${latest._id}/read`).expect(200);
    expect(read.body.data.readAt).toBeTruthy();
    expect((await buyer.get('/api/notifications/unread-count')).body.data.count).toBe(4);

    await buyer.patch('/api/notifications/read-all').expect(200);
    expect((await buyer.get('/api/notifications/unread-count')).body.data.count).toBe(0);
  });

  it('another user’s notification is a 404', async () => {
    const [mine] = (await buyer.get('/api/notifications?limit=1')).body.data;
    const res = await kaluppa.patch(`/api/notifications/${mine._id}/read`).expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('guests get 401 and unverified buyers 403 EMAIL_NOT_VERIFIED', async () => {
    await request(app).get('/api/notifications').expect(401);
    const unverified = await signedIn('buyer.unverified@kapekonek.test');
    const res = await unverified.get('/api/notifications/unread-count').expect(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('there is no chat: no chat.* permissions and no conversation routes', async () => {
    const me = await buyer.get('/api/auth/me').expect(200);
    expect(me.body.data.permissions.filter((slug) => slug.startsWith('chat.'))).toEqual([]);
    await buyer.get('/api/conversations/x/messages').expect(404);
  });
});
