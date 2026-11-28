import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { signedIn } from './helpers/farmers.js';

const mail = vi.hoisted(() => []);
const redis = vi.hoisted(() => ({ current: null }));
vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  redis.current = new RedisMock();
  return { getValkey: () => redis.current };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async (job, data) => { mail.push({ job, data }); }) }));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { ContactMessage, Setting } = await import('../src/models/index.js');
const { SETTING_DEFAULTS } = await import('../src/constants/settings.js');
const { processEmailJob } = await import('../src/queues/workers/email.worker.js');

// Change 08 Part G: Contact us.
const message = { name: 'Carla Reyes', email: 'Carla.Reyes@Example.com', phone: '0917 555 0100', topic: 'An order', orderNumber: 'KK-20261118-0014', message: 'Where is my order? It has been 6 days.' };
const send = (body, agent = request(app)) => agent.post('/api/contact').send(body);

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
});
afterAll(stopMemoryDb);
beforeEach(async () => {
  mail.length = 0;
  await redis.current.flushall();
  await ContactMessage.deleteMany({});
  await Setting.deleteMany({ key: 'branch' });
});

describe('Contact us', () => {
  it('saves the message and emails a copy to the sender; no branch email until Settings has one', async () => {
    const res = await send(message).expect(201);
    expect(res.body.data).toMatchObject({ sent: true });
    expect(await ContactMessage.findOne({}).lean()).toMatchObject({ name: 'Carla Reyes', email: 'carla.reyes@example.com', phone: '09175550100', orderNumber: 'KK-20261118-0014', user: null });
    expect(mail.map((m) => [m.job, m.data.to])).toEqual([['contact-copy', 'carla.reyes@example.com']]);

    await Setting.create({ key: 'branch', value: { ...SETTING_DEFAULTS.branch, contactEmail: 'branch.inbox@example.com' } });
    mail.length = 0;
    await send({ ...message, topic: 'Payment' }).expect(201);
    expect(mail.map((m) => [m.job, m.data.to])).toEqual([['contact-message', 'branch.inbox@example.com'], ['contact-copy', 'carla.reyes@example.com']]);
    expect((await ContactMessage.findOne({ topic: 'Payment' }).lean()).orderNumber).toBeNull(); // only for "An order"

    // The emails escape what the sender typed.
    const rendered = await processEmailJob({ name: 'contact-message', data: { ...mail[0].data, message: '<script>alert(1)</script> hello there' } });
    expect(JSON.stringify(rendered)).not.toContain('<script>');
  });

  it('validates with the shared contactSchema messages', async () => {
    const res = await send({ name: ' ', email: 'nope', topic: 'Other', message: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ name: 'Enter your name.', email: 'Enter a valid email, like name@gmail.com.', topic: 'Choose a topic.', message: 'Write at least 10 characters.' });
  });

  it('a filled honeypot looks sent but nothing is saved or emailed', async () => {
    await send({ ...message, website: 'http://spam.example' }).expect(201);
    expect(await ContactMessage.countDocuments()).toBe(0);
    expect(mail).toHaveLength(0);
  });

  it('allows 3 messages an hour per email (and per IP)', async () => {
    for (let i = 0; i < 3; i += 1) await send(message).expect(201);
    const fourth = await send(message);
    expect(fourth.status).toBe(429);
    expect(fourth.body.message).toBe('You’ve sent 3 messages this hour. Please try again later.');
    expect(await ContactMessage.countDocuments()).toBe(3);
  });

  it('Kaluppa lists and opens messages; others cannot', async () => {
    const buyer = await signedIn(app, 'buyer');
    await send({ ...message, name: 'Juana Signed In' }, buyer).expect(201);
    await send({ ...message, email: 'other@example.com', topic: 'Selling as a farmer', message: 'How do I sell beans to Kaluppa?' }).expect(201);
    const kaluppa = await signedIn(app, 'kaluppa');
    const list = await kaluppa.get('/api/admin/contact-messages?page=1&limit=10').expect(200);
    expect(list.body.meta.total).toBe(2);
    expect(list.body.data[0]).toMatchObject({ topic: 'Selling as a farmer', signedIn: false });
    expect((await kaluppa.get('/api/admin/contact-messages?q=juana')).body.data.map((m) => m.name)).toEqual(['Juana Signed In']);
    expect((await kaluppa.get('/api/admin/contact-messages?topic=An%20order')).body.data[0]).toMatchObject({ signedIn: true });
    expect((await kaluppa.get(`/api/admin/contact-messages/${list.body.data[1].id}`)).body.data.message).toBe(message.message);
    expect((await buyer.get('/api/admin/contact-messages')).status).toBe(403);
  });
});
