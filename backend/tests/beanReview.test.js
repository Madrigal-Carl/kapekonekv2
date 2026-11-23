import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { beanBody } from './helpers/beans.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { registerFarmer, setUpAssociations, signedIn } from './helpers/farmers.js';

const mail = vi.hoisted(() => []);
const pushed = vi.hoisted(() => []);
vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async (job, data) => { mail.push({ job, data }); }) }));
vi.mock('../src/clients/cloudinary.client.js', async () => (await import('./helpers/beans.js')).cloudinaryMock());
vi.mock('../src/sockets/realtime.js', () => ({ realtime: { toUser: (userId, event, payload) => pushed.push({ userId: String(userId), event, payload }) } }));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { AuditLog, FarmerProfile, Notification, User } = await import('../src/models/index.js');
const { beanStatus } = await import('../src/templates/email/beanStatus.template.js');

const DAY = 86_400_000;
let kaluppa, manager, managerId, ana, nomail;

async function farmerIn(username, association) {
  const f = await registerFarmer(app, User, username);
  await FarmerProfile.updateOne({ user: f.user._id }, { status: 'approved', association: association.id, approvedAt: new Date() });
  return f;
}
const listFor = async (f = ana) => (await f.agent.post('/api/beans').send(beanBody(f.user._id)).expect(201)).body.data;
const act = (agent, id, action, body = {}) => agent.post(`/api/beans/${id}/${action}`).send(body);

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users', 'settings'], log: () => {} });
  const a = await setUpAssociations(app, User);
  kaluppa = a.kaluppa;
  manager = await signedIn(app, 'manager.santacruz');
  managerId = String((await User.findOne({ username: 'manager.santacruz' }))._id);
  ana = await farmerIn('ana', a.santacruz);
  nomail = await farmerIn('nomail', a.santacruz);
  await User.updateOne({ _id: nomail.user._id }, { $unset: { email: 1 } });
});
beforeEach(() => {
  mail.length = 0;
  pushed.length = 0;
});
afterAll(stopMemoryDb);

describe('approve', () => {
  it('sets expiresAt 7 days after approval, emails the branch, hours and deadline, and tells the farmer and Group Manager', async () => {
    const listing = await listFor();
    const res = await act(kaluppa, listing.id, 'approve').expect(200);
    expect(res.body.message).toBe(`${listing.listingNumber} approved. Ana has 7 days to bring the beans.`);
    const { approvedAt, expiresAt, approvedBy } = res.body.data;
    expect(new Date(expiresAt) - new Date(approvedAt)).toBe(7 * DAY);
    expect(approvedBy.name).toBe('Kaluppa Admin');
    expect(res.body.data.history.map((h) => h.action)).toEqual(['listed', 'approved']);

    const [email] = mail.filter((m) => m.job === 'bean-status');
    expect(email.data).toMatchObject({ to: 'ana@example.com', status: 'approved', listingNumber: listing.listingNumber });
    const text = beanStatus(email.data).text;
    expect(text).toContain('Pantayin, Santa Cruz, Marinduque');
    expect(text).toContain('Mon–Sat, 8:00 AM – 5:00 PM');
    expect(text).toContain(new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }).format(new Date(expiresAt)));

    const notes = await Notification.find({ type: 'bean_status', 'data.listingId': listing.id }).lean();
    expect(notes.map((n) => String(n.user)).sort()).toEqual([String(ana.user._id), managerId].sort());
    const updates = pushed.filter((p) => p.event === 'bean:updated');
    expect(updates.map((p) => p.userId).sort()).toEqual([String(ana.user._id), managerId].sort());
    expect(updates[0].payload).toMatchObject({ id: listing.id, status: 'approved' });
    expect(await AuditLog.countDocuments({ area: 'beans', action: 'approve' })).toBe(1);
  });

  it('only Kaluppa reviews', async () => {
    const listing = await listFor();
    await act(ana.agent, listing.id, 'approve').expect(403);
    await act(manager, listing.id, 'approve').expect(403);
  });

  it('approve and reject at the same time: exactly one wins (Review Focus 5)', async () => {
    const listing = await listFor();
    const results = await Promise.all([act(kaluppa, listing.id, 'approve'), act(kaluppa, listing.id, 'reject', { reason: 'Moisture too high for storage' })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409).body.message).toBe('This listing was already decided.');
  });
});

describe('reject', () => {
  it('needs a reason, and emails it', async () => {
    const listing = await listFor();
    const missing = await act(kaluppa, listing.id, 'reject').expect(400);
    expect(missing.body.errors.reason).toBeTruthy();
    const res = await act(kaluppa, listing.id, 'reject', { reason: 'Moisture too high for storage' }).expect(200);
    expect(res.body.data).toMatchObject({ status: 'rejected', rejection: { reason: 'Moisture too high for storage' }, canEdit: false });
    expect(beanStatus(mail.find((m) => m.job === 'bean-status').data).text).toContain('Moisture too high for storage');
  });

  it('a farmer with no email still gets the in-app notification', async () => {
    const listing = await listFor(nomail);
    await act(kaluppa, listing.id, 'reject', { reason: 'Photos are too blurry' }).expect(200);
    expect(mail.filter((m) => m.data.to)).toHaveLength(0);
    expect(await Notification.countDocuments({ user: nomail.user._id, type: 'bean_status' })).toBe(1);
  });
});

describe('complete', () => {
  it('keeps the listed values and the final ones', async () => {
    const listing = await listFor();
    await act(kaluppa, listing.id, 'complete', { finalWeightKg: 1.8, finalAmountCentavos: 32_400 }).expect(409);
    await act(kaluppa, listing.id, 'approve').expect(200);
    await act(kaluppa, listing.id, 'complete', { finalWeightKg: 0, finalAmountCentavos: 32_400 }).expect(400);
    const res = await act(kaluppa, listing.id, 'complete', { finalWeightKg: 1.8, finalAmountCentavos: 32_400 }).expect(200);
    expect(res.body.message).toBe(`${listing.listingNumber} completed.`);
    expect(res.body.data).toMatchObject({ status: 'completed', weightKg: 2, amountCentavos: 36_000, completion: { finalWeightKg: 1.8, finalAmountCentavos: 32_400 } });
    expect(beanStatus(mail.at(-1).data).text).toContain('1.8 kg');
  });
});

describe('cancel', () => {
  it('the farmer cancels while pending or approved, without a reason; Kaluppa is told', async () => {
    const pending = await listFor();
    const res = await act(ana.agent, pending.id, 'cancel').expect(200);
    expect(res.body.data).toMatchObject({ status: 'cancelled', cancellation: { byRole: 'farmer' } });
    const approved = await listFor();
    await act(kaluppa, approved.id, 'approve').expect(200);
    await act(ana.agent, approved.id, 'cancel').expect(200);
    await act(ana.agent, approved.id, 'cancel').expect(409);
    const kaluppaId = (await User.findOne({ username: 'kaluppa' }))._id;
    expect(await Notification.countDocuments({ user: kaluppaId, type: 'bean_status', 'data.listingId': pending.id })).toBe(1);
  });

  it('Kaluppa cancels only approved listings, with a reason, and the farmer is emailed', async () => {
    const listing = await listFor();
    await act(kaluppa, listing.id, 'cancel', { reason: 'Not brought within the agreed date' }).expect(409);
    await act(kaluppa, listing.id, 'approve').expect(200);
    const missing = await act(kaluppa, listing.id, 'cancel').expect(400);
    expect(missing.body.errors.reason).toBeTruthy();
    const res = await act(kaluppa, listing.id, 'cancel', { reason: 'Not brought within the agreed date' }).expect(200);
    expect(res.body.data.cancellation).toMatchObject({ byRole: 'kaluppa', reason: 'Not brought within the agreed date' });
    expect(mail.at(-1).data).toMatchObject({ to: 'ana@example.com', status: 'cancelled' });
  });
});
