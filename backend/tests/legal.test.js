import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { signedIn } from './helpers/farmers.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async () => {}) }));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { User, AuditLog } = await import('../src/models/index.js');
const { parseSections } = await import('../src/services/legal.service.js');

// Change 09: Terms and Conditions.
beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users', 'associations'], log: () => {} });
});
afterAll(stopMemoryDb);

describe('Terms and Conditions', () => {
  it('GET /legal/current is public and serves both documents from the versioned files', async () => {
    const { data } = (await request(app).get('/api/legal/current').expect(200)).body;
    expect(data).toMatchObject({ version: 1, updatedAt: '2026-11-28' });
    expect(data.terms.map((s) => s.heading)).toEqual(['1. Using KapeKonek', '2. Your account', '3. Orders and payment', '4. Selling beans as a farmer', '5. Community Hub and messages', '6. Reviews', '7. Changes and contact']);
    expect(data.privacy[4]).toMatchObject({ heading: 'Your rights', paragraphs: [expect.stringContaining('Republic Act No. 10173')] });
    expect(JSON.stringify(data)).not.toContain('DRAFT');
  });

  it('parses headings and paragraphs, dropping comments', () => {
    expect(parseSections('<!-- note -->\n\n## One\n\nFirst.\n\nSecond.\n\n## Two\n\nThird.\n')).toEqual([
      { heading: 'One', paragraphs: ['First.', 'Second.'] },
      { heading: 'Two', paragraphs: ['Third.'] },
    ]);
  });

  it('seeds every account as accepted at the current version', async () => {
    expect(await User.countDocuments({ termsVersion: { $ne: 1 } })).toBe(0);
    expect(await User.countDocuments({ termsAcceptedAt: null })).toBe(0);
  });

  it('a created account agrees once: the session says who made it, accept stores the version and audits it', async () => {
    await User.updateOne({ username: 'farmer.unverified' }, { termsVersion: 0, termsAcceptedAt: null, emailVerifiedAt: new Date() });
    const farmer = await signedIn(app, 'farmer.unverified');
    const me = (await farmer.get('/api/auth/me').expect(200)).body.data.user;
    expect(me).toMatchObject({ mustAcceptTerms: true, createdBy: { name: 'Liza Ramos', isKaluppa: false } });

    expect((await farmer.post('/api/legal/accept').send({ version: 2 })).status).toBe(409);
    const res = await farmer.post('/api/legal/accept').send({ version: 1 }).expect(200);
    expect(res.body.data.user.mustAcceptTerms).toBe(false);
    const saved = await User.findOne({ username: 'farmer.unverified' }).lean();
    expect(saved.termsVersion).toBe(1);
    expect(await AuditLog.countDocuments({ entityId: saved._id, action: 'accept_terms' })).toBe(1);
    expect((await request(app).post('/api/legal/accept').send({ version: 1 })).status).toBe(401);
  });
});
