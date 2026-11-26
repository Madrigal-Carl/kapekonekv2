import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { registerFarmer, setUpAssociations, signedIn } from './helpers/farmers.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn() }));
// Every upload is a 400 KB jpg, except `big.*` (7 MB) and `notes.exe`.
vi.mock('../src/clients/cloudinary.client.js', () => ({
  getUploadedAsset: async (publicId) => {
    const name = publicId.split('/').pop();
    if (name === 'big') return { bytes: 7_000_000, format: 'jpg', resourceType: 'image', originalFilename: name };
    if (name === 'notes') return { bytes: 1000, format: 'exe', resourceType: 'image', originalFilename: name };
    return { bytes: 400_000, format: 'jpg', resourceType: 'image', originalFilename: name };
  },
  destroyImage: async () => {},
}));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { FarmerProfile, Message, User } = await import('../src/models/index.js');
const chat = await import('../src/services/chat.service.js');
const { canMessage, receiptFor } = await import('../src/services/inbox.service.js');

let a, kaluppa, manager, boacManager;
let ana, cora, ben, dan;
const ids = {};

/** A farmer signed up through the API, then approved into `association` with the group chat joined. */
async function farmerIn(username, association) {
  const f = await registerFarmer(app, User, username);
  if (association) {
    await FarmerProfile.updateOne({ user: f.user._id }, { status: 'approved', association: association.id, approvedAt: new Date() });
    await chat.joinGroup(f.user._id, association.id);
  }
  ids[username] = String(f.user._id);
  return f;
}
const conversations = async (agent, query = '') => (await agent.get(`/api/conversations${query}`).expect(200)).body.data;
const send = (agent, id, body) => agent.post(`/api/conversations/${id}/messages`).send(typeof body === 'string' ? { body } : body);
const messages = async (agent, id, query = '') => (await agent.get(`/api/conversations/${id}/messages${query}`).expect(200)).body;
const attachment = (userId, name = 'leaf') => ({
  url: `https://res.cloudinary.com/test/image/upload/v1/kapekonek/message-attachments/${userId}/${name}.jpg`,
  publicId: `kapekonek/message-attachments/${userId}/${name}`,
});

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users', 'settings'], log: () => {} });
  a = await setUpAssociations(app, User);
  kaluppa = a.kaluppa;
  manager = await signedIn(app, 'manager.santacruz');
  boacManager = await signedIn(app, 'manager.unassigned');
  ids.manager = String((await User.findOne({ username: 'manager.santacruz' }))._id);
  ids.kaluppa = String((await User.findOne({ username: 'kaluppa' }))._id);
  ana = await farmerIn('ana', a.santacruz);
  cora = await farmerIn('cora', a.santacruz);
  ben = await farmerIn('ben', a.boac);
  dan = await farmerIn('dan', null);
});
afterAll(stopMemoryDb);

describe('who can message whom (PHASE-2-SPEC §3.9)', () => {
  const scoped = (id, roles, associationId = null) => ({ _id: new mongoose.Types.ObjectId(id), roles, associationId });
  const sc = new mongoose.Types.ObjectId();
  const boac = new mongoose.Types.ObjectId();
  const farmer = scoped('a'.repeat(24), ['farmer'], sc);
  const coFarmer = scoped('b'.repeat(24), ['farmer'], sc);
  const otherFarmer = scoped('c'.repeat(24), ['farmer'], boac);
  const unaffiliated = scoped('d'.repeat(24), ['farmer']);
  const gm = scoped('e'.repeat(24), ['group_manager'], sc);
  const otherGm = scoped('f'.repeat(24), ['group_manager'], boac);
  const team = scoped('1'.repeat(24), ['kaluppa']);

  it.each([
    ['farmer → co-farmer', farmer, coFarmer, true],
    ['farmer → their Group Manager', farmer, gm, true],
    ['farmer → Kaluppa', farmer, team, true],
    ['farmer → farmer of another association', farmer, otherFarmer, false],
    ['farmer → another Group Manager', farmer, otherGm, false],
    ['farmer → themselves', farmer, farmer, false],
    ['unaffiliated farmer → Kaluppa', unaffiliated, team, true],
    ['unaffiliated farmer → a farmer', unaffiliated, coFarmer, false],
    ['farmer → unaffiliated farmer', farmer, unaffiliated, false],
    ['Group Manager → its farmer', gm, farmer, true],
    ['Group Manager → another association’s farmer', gm, otherFarmer, false],
    ['Group Manager → Group Manager', gm, otherGm, false],
    ['Group Manager → Kaluppa', gm, team, true],
    ['Kaluppa → any farmer', team, otherFarmer, true],
    ['Kaluppa → unaffiliated farmer', team, unaffiliated, true],
    ['Kaluppa → any Group Manager', team, otherGm, true],
  ])('%s: %s', (_label, user, other, allowed) => {
    expect(canMessage(user, other)).toBe(allowed);
  });

  it('/inbox/people returns only people the user may message', async () => {
    const names = async (agent, q = '') => (await agent.get(`/api/inbox/people${q}`).expect(200)).body.data.map((p) => p.name).sort();
    expect(await names(ana.agent)).toEqual(['Cora Farmer', 'Kaluppa', 'Liza Ramos']);
    expect(await names(dan.agent)).toEqual(['Kaluppa']);
    expect(await names(manager)).toEqual(['Ana Farmer', 'Cora Farmer', 'Kaluppa']);
    expect(await names(boacManager)).toEqual(['Ben Farmer', 'Kaluppa']);
    const forKaluppa = await names(kaluppa);
    expect(forKaluppa).toEqual(expect.arrayContaining(['Ana Farmer', 'Ben Farmer', 'Cora Farmer', 'Dan Farmer', 'Liza Ramos', 'Ramon Aguilar']));
    expect(forKaluppa).not.toContain('Kaluppa');
    expect(forKaluppa).not.toContain('Juana Dela Cruz'); // buyers have no inbox
    expect(await names(ana.agent, '?q=cor')).toEqual(['Cora Farmer']);
  });

  it('a buyer has no inbox', async () => {
    const buyer = await signedIn(app, 'buyer');
    await buyer.get('/api/conversations').expect(403);
    await buyer.get('/api/inbox/people').expect(403);
  });
});

describe('conversations', () => {
  it('a second POST /conversations/direct returns the same chat; a not-allowed person is refused', async () => {
    const first = (await ana.agent.post('/api/conversations/direct').send({ userId: ids.cora }).expect(200)).body.data;
    const again = (await ana.agent.post('/api/conversations/direct').send({ userId: ids.cora }).expect(200)).body.data;
    expect(again.id).toBe(first.id);
    expect(first).toMatchObject({ type: 'direct', name: 'Cora Farmer', canPost: true });
    const fromCora = (await cora.agent.post('/api/conversations/direct').send({ userId: ids.ana }).expect(200)).body.data;
    expect(fromCora.id).toBe(first.id);
    await ana.agent.post('/api/conversations/direct').send({ userId: ids.ben }).expect(403);
  });

  it('a direct chat and its messages carry the person’s profile photo; groups keep their initials tile', async () => {
    const url = 'https://res.cloudinary.com/test/image/upload/v1/kapekonek/avatars/cora.jpg';
    await User.updateOne({ _id: ids.cora }, { avatar: { url, publicId: 'kapekonek/avatars/cora' } });
    const direct = (await ana.agent.post('/api/conversations/direct').send({ userId: ids.cora }).expect(200)).body.data;
    await send(cora.agent, direct.id, 'Hello Ana').expect(201);
    const list = await conversations(ana.agent);
    expect(list.find((c) => c.id === direct.id).avatarUrl).toBe(url);
    expect(list.find((c) => c.type === 'group').avatarUrl).toBeNull();
    expect((await messages(ana.agent, direct.id)).data[0].sender.avatarUrl).toBe(url);
    await ana.agent.post(`/api/conversations/${direct.id}/read`).expect((res) => expect(res.status).toBeLessThan(300));
    await User.updateOne({ _id: ids.cora }, { $unset: { avatar: 1 } });
  });

  it('messaging Kaluppa opens the farmer’s Kaluppa team chat, from either side', async () => {
    const mine = (await dan.agent.post('/api/conversations/direct').send({ userId: 'kaluppa' }).expect(200)).body.data;
    expect(mine).toMatchObject({ type: 'kaluppa', name: 'Kaluppa' });
    const theirs = (await kaluppa.post('/api/conversations/direct').send({ userId: ids.dan }).expect(200)).body.data;
    expect(theirs).toMatchObject({ id: mine.id, type: 'kaluppa', name: 'Dan Farmer' });
  });

  it('lists the group with its members, filters Unread / Groups and searches by name', async () => {
    const all = await conversations(ana.agent);
    const group = all.find((c) => c.type === 'group');
    expect(group).toMatchObject({ name: 'Santa Cruz Growers', memberCount: 3, sub: '3 members · Liza and 2 farmers' });
    expect(all[0]).toMatchObject({ type: 'kaluppa', name: 'Kaluppa' }); // pinned first
    expect((await conversations(ana.agent, '?filter=groups')).map((c) => c.type)).toEqual(['group']);
    expect((await conversations(ana.agent, '?q=cora')).map((c) => c.name)).toEqual(['Cora Farmer']);
    await send(cora.agent, group.id, 'Pruning demo on Thursday').expect(201);
    expect((await conversations(ana.agent, '?filter=unread')).map((c) => [c.name, c.unread])).toEqual([['Santa Cruz Growers', 1]]);
    expect((await conversations(ana.agent, '?filter=unread'))[0].lastMessage).toMatchObject({ text: 'Pruning demo on Thursday', senderName: 'Cora', mine: false });
  });

  it('Kaluppa sees farmer chats only once they have messages, and the sidebar badge counts unread chats', async () => {
    expect((await conversations(kaluppa)).map((c) => c.name)).not.toContain('Ben Farmer');
    const benChat = (await ben.agent.post('/api/conversations/direct').send({ userId: 'kaluppa' }).expect(200)).body.data;
    await send(ben.agent, benChat.id, 'Hello Kaluppa').expect(201);
    const listed = await conversations(kaluppa);
    expect(listed.find((c) => c.id === benChat.id)).toMatchObject({ name: 'Ben Farmer', unread: 1, sub: 'Farmer · Boac Growers' });
    expect((await kaluppa.get('/api/dashboard/badges').expect(200)).body.data.inbox).toBe(1);
    await kaluppa.post(`/api/conversations/${benChat.id}/read`).expect(200);
    expect((await kaluppa.get('/api/dashboard/badges').expect(200)).body.data.inbox).toBe(0);
  });

  it('a non-member gets 404 for someone else’s chat', async () => {
    const direct = (await ana.agent.post('/api/conversations/direct').send({ userId: ids.cora }).expect(200)).body.data;
    await ben.agent.get(`/api/conversations/${direct.id}`).expect(404);
    await ben.agent.get(`/api/conversations/${direct.id}/messages`).expect(404);
    await send(ben.agent, direct.id, 'hi').expect(404);
  });
});

describe('messages', () => {
  let direct;
  beforeAll(async () => {
    direct = (await ana.agent.post('/api/conversations/direct').send({ userId: ids.cora }).expect(200)).body.data;
  });

  it('sends text, replies with a quote, and validates the body', async () => {
    const first = (await send(ana.agent, direct.id, 'Leaf rust again. Any tips?').expect(201)).body.data;
    expect(first).toMatchObject({ body: 'Leaf rust again. Any tips?', mine: true, author: 'Ana Farmer', deleted: false, editedAt: null });
    const reply = (await send(cora.agent, direct.id, { body: 'Space the branches.', replyTo: first.id }).expect(201)).body.data;
    expect(reply.replyTo).toMatchObject({ id: first.id, author: 'Ana Farmer', text: 'Leaf rust again. Any tips?' });
    const tooLong = await send(ana.agent, direct.id, 'x'.repeat(2001)).expect(400);
    expect(tooLong.body.errors.body).toBeTruthy();
    await send(ana.agent, direct.id, '   ').expect(400);
  });

  it('attachments follow the upload rules', async () => {
    const photo = (await send(ana.agent, direct.id, { attachments: [attachment(ids.ana)] }).expect(201)).body.data;
    expect(photo.attachments).toEqual([expect.objectContaining({ kind: 'image', name: 'leaf.jpg', bytes: 400_000 })]);
    expect((await conversations(cora.agent, '?q=ana'))[0].lastMessage.text).toBe('Photo');
    const big = await send(ana.agent, direct.id, { attachments: [attachment(ids.ana, 'big')] }).expect(422);
    expect(big.body.code).toBe('FILE_TOO_LARGE');
    await send(ana.agent, direct.id, { attachments: [attachment(ids.ana, 'notes')] }).expect(422);
    await send(ana.agent, direct.id, { attachments: [attachment(ids.cora)] }).expect(400); // someone else's upload
  });

  it('edits within 15 minutes only, and only your own', async () => {
    const m = (await send(ana.agent, direct.id, 'Typo hear').expect(201)).body.data;
    await cora.agent.patch(`/api/messages/${m.id}`).send({ body: 'Mine now' }).expect(403);
    await Message.collection.updateOne({ _id: new mongoose.Types.ObjectId(m.id) }, { $set: { createdAt: new Date(Date.now() - (14 * 60 + 59) * 1000) } });
    const edited = (await ana.agent.patch(`/api/messages/${m.id}`).send({ body: 'Typo here' }).expect(200)).body.data;
    expect(edited.body).toBe('Typo here');
    expect(edited.editedAt).toBeTruthy();
    await Message.collection.updateOne({ _id: new mongoose.Types.ObjectId(m.id) }, { $set: { createdAt: new Date(Date.now() - (15 * 60 + 1) * 1000) } });
    await ana.agent.patch(`/api/messages/${m.id}`).send({ body: 'Too late' }).expect(403);
  });

  it('delete for everyone leaves a tombstone; delete for me hides it from that user only', async () => {
    const gone = (await send(ana.agent, direct.id, 'Wrong chat').expect(201)).body.data;
    await cora.agent.delete(`/api/messages/${gone.id}?for=everyone`).expect(403);
    await ana.agent.delete(`/api/messages/${gone.id}?for=everyone`).expect(200);
    const seenByCora = (await messages(cora.agent, direct.id)).data.find((m) => m.id === gone.id);
    expect(seenByCora).toMatchObject({ deleted: true, body: null, attachments: [] });
    expect(await Message.exists({ _id: gone.id })).toBeTruthy();
    expect((await conversations(cora.agent, '?q=ana'))[0].lastMessage.text).toBe('This message was deleted');

    const hidden = (await send(ana.agent, direct.id, 'Just for Cora').expect(201)).body.data;
    await cora.agent.delete(`/api/messages/${hidden.id}?for=me`).expect(200);
    expect((await messages(cora.agent, direct.id)).data.map((m) => m.id)).not.toContain(hidden.id);
    expect((await messages(ana.agent, direct.id)).data.map((m) => m.id)).toContain(hidden.id);
  });

  it('pages 75 messages newest first, 30 at a time', async () => {
    const own = (await manager.post('/api/conversations/direct').send({ userId: ids.cora }).expect(200)).body.data;
    for (let i = 1; i <= 75; i++) await send(manager, own.id, `m${i}`).expect(201);
    const p1 = await messages(manager, own.id);
    expect(p1.data.map((m) => m.body).slice(0, 2)).toEqual(['m75', 'm74']);
    expect(p1.meta.hasMore).toBe(true);
    const p2 = await messages(manager, own.id, `?before=${p1.meta.nextCursor}`);
    const p3 = await messages(manager, own.id, `?before=${p2.meta.nextCursor}`);
    expect([p1.data.length, p2.data.length, p3.data.length]).toEqual([30, 30, 15]);
    expect(p3.data.at(-1).body).toBe('m1');
    expect(p3.meta).toMatchObject({ hasMore: false, nextCursor: null });
  }, 30_000); // 75 sequential sends: slow under a loaded full run

  it('Kaluppa team replies show the Kaluppa sender’s name', async () => {
    const team = (await kaluppa.post('/api/conversations/direct').send({ userId: ids.ana }).expect(200)).body.data;
    await send(kaluppa, team.id, 'Your listing is approved.').expect(201);
    const [latest] = (await messages(ana.agent, team.id)).data;
    expect(latest).toMatchObject({ author: 'Kaluppa', mine: false, sender: { team: 'kaluppa' } });
    expect((await conversations(ana.agent))[0].lastMessage).toMatchObject({ senderName: 'Kaluppa', mine: false });
  });
});

describe('read-only chats and delivery receipts', () => {
  it('a read-only member keeps the history but can’t send, and sees nothing after leaving', async () => {
    const group = (await conversations(ben.agent, '?filter=groups'))[0];
    await send(ben.agent, group.id, 'Before I go').expect(201);
    await chat.endMembership(ids.ben, [group.id]);
    const res = await send(ben.agent, group.id, 'Still here?').expect(403);
    expect(res.body.message).toMatch(/read-only/i);
    await send(boacManager, group.id, 'After Ben left').expect(201);
    const list = await conversations(ben.agent, '?filter=groups');
    expect(list[0]).toMatchObject({ canPost: false, lastMessage: { text: 'Before I go' } });
    expect(list[0].leftAt).toBeTruthy();
    expect((await messages(ben.agent, group.id)).data.map((m) => m.body)).toEqual(['Before I go']);
    await chat.joinGroup(ids.ben, a.boac.id); // put Ben back for the other tests
  });

  it('derives sent / delivered / seen from the member cursors, and "Seen by N" in groups', () => {
    const at = new Date('2026-11-26T01:00:00Z');
    const before = new Date('2026-11-26T00:59:00Z');
    const after = new Date('2026-11-26T01:01:00Z');
    const m = (initials, lastDeliveredAt, lastReadAt) => ({ id: initials, name: initials, initials, lastDeliveredAt, lastReadAt });
    expect(receiptFor(at, [m('CF', before, before)], 'direct')).toEqual({ state: 'sent', label: 'Sent', seenBy: [] });
    expect(receiptFor(at, [m('CF', after, before)], 'direct')).toMatchObject({ state: 'delivered', label: 'Delivered' });
    expect(receiptFor(at, [m('CF', after, after)], 'direct')).toMatchObject({ state: 'seen', label: 'Seen' });
    const group = receiptFor(at, [m('NP', after, after), m('LI', after, after), m('LR', after, before)], 'group');
    expect(group).toMatchObject({ state: 'seen', label: 'Seen by 2' });
    expect(group.seenBy.map((s) => s.initials)).toEqual(['NP', 'LI']);
  });

  it('a fetch marks delivered, opening the chat marks seen, and the detail carries the receipt', async () => {
    const direct = (await ana.agent.post('/api/conversations/direct').send({ userId: ids.cora }).expect(200)).body.data;
    await send(ana.agent, direct.id, 'Receipt check').expect(201);
    const receipt = async () => (await ana.agent.get(`/api/conversations/${direct.id}`).expect(200)).body.data.receipt;
    expect(await receipt()).toMatchObject({ state: 'sent' });
    await conversations(cora.agent);
    expect(await receipt()).toMatchObject({ state: 'delivered' });
    await cora.agent.post(`/api/conversations/${direct.id}/read`).expect(200);
    expect(await receipt()).toMatchObject({ state: 'seen', label: 'Seen' });
    expect((await conversations(cora.agent, '?filter=unread')).map((c) => c.id)).not.toContain(direct.id);
  });
});
