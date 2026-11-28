import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { registerFarmer, setUpAssociations, signedIn } from './helpers/farmers.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async () => {}) }));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { FarmerProfile, Notification, Post, User } = await import('../src/models/index.js');

// Change 08 Part F: Hub @mentions, scoped like the Inbox and re-checked on the server.
let associations, gm, gmName, kaluppaIds, ana, ben, cid;
const approve = async (username, association) => {
  const { agent, user } = await registerFarmer(app, User, username);
  await FarmerProfile.updateOne({ user: user._id }, { status: 'approved', association: association.id });
  return { agent, id: String(user._id) };
};
const mentionsOf = (userId) => Notification.find({ user: userId, type: 'mention' }).lean();

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  associations = await setUpAssociations(app, User);
  const manager = await User.findOne({ username: 'manager.santacruz' }).lean();
  gm = { agent: await signedIn(app, 'manager.santacruz'), id: String(manager._id) };
  gmName = `${manager.firstName} ${manager.lastName}`;
  kaluppaIds = (await User.find({ roles: 'kaluppa' }, '_id').lean()).map((u) => String(u._id));
  [ana, ben, cid] = [await approve('ana', associations.santacruz), await approve('ben', associations.santacruz), await approve('cid', associations.boac)];
});
afterAll(stopMemoryDb);

describe('Hub @mentions', () => {
  it('a farmer may mention Kaluppa, their Group Manager and co-farmers; the rest are dropped', async () => {
    const body = `Salamat @Kaluppa, @${gmName}, @Ben Farmer and @Cid Farmer!`;
    const res = await ana.agent.post('/api/hub/posts').send({ body, mentions: ['kaluppa', gm.id, ben.id, cid.id, associations.santacruz.id] }).expect(201);
    const stored = (await Post.findById(res.body.data._id).lean()).mentions.map(String).sort();
    expect(stored).toEqual([...kaluppaIds, gm.id, ben.id].sort()); // Cid is in Boac; the last id isn't a person
    expect(res.body.data.mentions.map((m) => m.name).sort()).toEqual(['Ben Farmer', gmName, 'Kaluppa'].sort());
    expect(res.body.data.mentions.find((m) => m.name === 'Ben Farmer').sub).toBe('Farmer · Santa Cruz Growers');

    expect(await mentionsOf(ben.id)).toEqual([expect.objectContaining({ title: 'Ana Farmer mentioned you in a post', link: `/dashboard/hub/posts/${res.body.data._id}` })]);
    expect(await mentionsOf(gm.id)).toHaveLength(1);
    expect(await mentionsOf(kaluppaIds[0])).toHaveLength(1);
    expect(await mentionsOf(cid.id)).toHaveLength(0);
  });

  it('drops a mention whose name is not in the text, and only tells people newly mentioned on edit', async () => {
    const created = (await ana.agent.post('/api/hub/posts').send({ body: 'Drying beds ready.', mentions: [ben.id] }).expect(201)).body.data;
    expect(created.mentions).toEqual([]);
    const before = (await mentionsOf(ben.id)).length;
    await ana.agent.patch(`/api/hub/posts/${created._id}`).send({ body: 'Drying beds ready, @Ben Farmer.', mentions: [ben.id] }).expect(200);
    await ana.agent.patch(`/api/hub/posts/${created._id}`).send({ body: 'Drying beds ready, @Ben Farmer!', mentions: [ben.id] }).expect(200);
    expect(await mentionsOf(ben.id)).toHaveLength(before + 1);
  });

  it('a Group Manager mentions Kaluppa and their own farmers; Kaluppa mentions anyone but Kaluppa', async () => {
    const post = (await gm.agent.post('/api/hub/posts').send({ body: `@Kaluppa @Ana Farmer @Cid Farmer`, mentions: ['kaluppa', ana.id, cid.id] }).expect(201)).body.data;
    expect(post.mentions.map((m) => m.name).sort()).toEqual(['Ana Farmer', 'Kaluppa']);

    const kaluppa = await signedIn(app, 'kaluppa');
    const comment = (await kaluppa.post(`/api/posts/${post._id}/comments`).send({ body: `@Cid Farmer @${gmName} @Kaluppa`, mentions: [cid.id, gm.id, 'kaluppa'] }).expect(201)).body.data;
    expect(comment.mentions.map((m) => m.name).sort()).toEqual(['Cid Farmer', gmName].sort());
    expect(await mentionsOf(cid.id)).toEqual([expect.objectContaining({ title: 'Kaluppa mentioned you in a comment' })]);
    // Comments come back with their mentions in the thread too.
    const thread = (await gm.agent.get(`/api/posts/${post._id}/comments`).expect(200)).body.data;
    expect(thread[0].mentions.map((m) => m.name).sort()).toEqual(['Cid Farmer', gmName].sort());
  });
});
