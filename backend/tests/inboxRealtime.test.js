import http from 'node:http';
import { io as connect } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { registerFarmer, setUpAssociations, signedIn } from './helpers/farmers.js';

// In-memory adapter: one process, no pub/sub needed.
vi.mock('@socket.io/redis-adapter', () => ({ createAdapter: () => undefined }));
vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis, createValkeyConnection: () => new RedisMock() };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn() }));

const { default: app } = await import('../src/app.js');
const { initSockets } = await import('../src/sockets/index.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { FarmerProfile, User } = await import('../src/models/index.js');
const chat = await import('../src/services/chat.service.js');
const { signAccessToken } = await import('../src/utils/tokens.js');

let server;
let io;
let url;
let a;
const clients = [];
const people = {};

function open(user) {
  const socket = connect(url, { transports: ['websocket'], extraHeaders: { cookie: `accessToken=${signAccessToken(user)}` }, reconnection: false, forceNew: true });
  clients.push(socket);
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}
/** The next `event` on the socket, or null after `ms`. */
const next = (socket, event, ms = 400) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

async function farmerIn(username, association) {
  const f = await registerFarmer(app, User, username);
  if (association) {
    await FarmerProfile.updateOne({ user: f.user._id }, { status: 'approved', association: association.id, approvedAt: new Date() });
    await chat.joinGroup(f.user._id, association.id);
  }
  people[username] = f;
  return f;
}
const groupOf = async (agent) => (await agent.get('/api/conversations?filter=groups').expect(200)).body.data[0];

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users', 'settings'], log: () => {} });
  server = http.createServer(app);
  io = initSockets(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  a = await setUpAssociations(app, User);
  await farmerIn('ana', a.santacruz);
  await farmerIn('cora', a.santacruz);
  await farmerIn('ben', a.boac);
});
afterAll(async () => {
  for (const socket of clients) socket.close();
  await io.close();
  await stopMemoryDb();
});

describe('conversation rooms', () => {
  it('members get message:new; a non-member of the chat never does', async () => {
    const [ana, cora, ben] = await Promise.all(['ana', 'cora', 'ben'].map((u) => open(people[u].user)));
    const group = await groupOf(people.ana.agent);
    const [toCora, toBen, sent] = await Promise.all([
      next(cora, 'message:new'),
      next(ben, 'message:new'),
      people.ana.agent.post(`/api/conversations/${group.id}/messages`).send({ body: 'Meeting at 8' }).expect(201),
    ]);
    expect(toCora).toEqual({ conversationId: group.id, messageId: sent.body.data.id });
    expect(toBen).toBeNull();
    // edits and deletes reach the same members only
    const [edited, benEdit] = await Promise.all([
      next(cora, 'message:updated'),
      next(ben, 'message:updated'),
      people.ana.agent.patch(`/api/messages/${sent.body.data.id}`).send({ body: 'Meeting at 9' }).expect(200),
    ]);
    expect(edited).toMatchObject({ conversationId: group.id, messageId: sent.body.data.id });
    expect(benEdit).toBeNull();
    const [deleted] = await Promise.all([next(cora, 'message:deleted'), people.ana.agent.delete(`/api/messages/${sent.body.data.id}?for=everyone`).expect(200)]);
    expect(deleted).toMatchObject({ messageId: sent.body.data.id });
    for (const s of [ana, cora, ben]) s.close();
  });

  it('Kaluppa accounts hear every Kaluppa chat through team:kaluppa, and the farmer hears the reply', async () => {
    const kaluppaUser = await User.findOne({ username: 'kaluppa' }).lean();
    const [team, ana, cora] = await Promise.all([open(kaluppaUser), open(people.ana.user), open(people.cora.user)]);
    const own = (await people.ana.agent.post('/api/conversations/direct').send({ userId: 'kaluppa' }).expect(200)).body.data;
    const [toTeam, toCora] = await Promise.all([
      next(team, 'message:new'),
      next(cora, 'message:new'),
      people.ana.agent.post(`/api/conversations/${own.id}/messages`).send({ body: 'Hello Kaluppa' }).expect(201),
    ]);
    expect(toTeam).toMatchObject({ conversationId: own.id });
    expect(toCora).toBeNull();
    const kaluppa = await signedIn(app, 'kaluppa');
    const [toAna, read] = await Promise.all([
      next(ana, 'message:new'),
      next(ana, 'conversation:read'),
      kaluppa.post(`/api/conversations/${own.id}/messages`).send({ body: 'Hi Ana!' }).expect(201).then(() => kaluppa.post(`/api/conversations/${own.id}/read`).expect(200)),
    ]);
    expect(toAna).toMatchObject({ conversationId: own.id });
    expect(read).toMatchObject({ conversationId: own.id });
    for (const s of [team, ana, cora]) s.close();
  });

  it('a chat created after the socket connected is joined at once', async () => {
    const [ana, cora] = await Promise.all([open(people.ana.user), open(people.cora.user)]);
    const direct = (await people.ana.agent.post('/api/conversations/direct').send({ userId: String(people.cora.user._id) }).expect(200)).body.data;
    const [got] = await Promise.all([next(cora, 'message:new'), people.ana.agent.post(`/api/conversations/${direct.id}/messages`).send({ body: 'New chat' }).expect(201)]);
    expect(got).toMatchObject({ conversationId: direct.id });
    ana.close();
    cora.close();
  });
});

describe('typing and delivery', () => {
  it('typing relays only to the other members, with a 5-second expiry', async () => {
    const [ana, anaTab2, cora, ben] = await Promise.all([open(people.ana.user), open(people.ana.user), open(people.cora.user), open(people.ben.user)]);
    const group = await groupOf(people.ana.agent);
    const [toCora, toBen, toSelf] = await Promise.all([next(cora, 'typing'), next(ben, 'typing'), next(ana, 'typing'), Promise.resolve(ana.emit('typing', { conversationId: group.id }))]);
    expect(toCora).toMatchObject({ conversationId: group.id, user: { id: String(people.ana.user._id), name: 'Ana' }, expiresInMs: 5000 });
    expect(toBen).toBeNull();
    expect(toSelf).toBeNull();
    // someone outside the chat can't type into it
    const [leak] = await Promise.all([next(cora, 'typing'), Promise.resolve(ben.emit('typing', { conversationId: group.id }))]);
    expect(leak).toBeNull();
    for (const s of [ana, anaTab2, cora, ben]) s.close();
  });

  it('a recipient’s socket acknowledging delivery moves its cursor and tells the sender', async () => {
    const [ana, cora] = await Promise.all([open(people.ana.user), open(people.cora.user)]);
    const direct = (await people.ana.agent.post('/api/conversations/direct').send({ userId: String(people.cora.user._id) }).expect(200)).body.data;
    await people.ana.agent.post(`/api/conversations/${direct.id}/messages`).send({ body: 'Delivered?' }).expect(201);
    const [delivered] = await Promise.all([next(ana, 'conversation:delivered'), Promise.resolve(cora.emit('conversation:delivered', { conversationId: direct.id }))]);
    expect(delivered).toMatchObject({ conversationId: direct.id });
    expect((await people.ana.agent.get(`/api/conversations/${direct.id}`).expect(200)).body.data.receipt).toMatchObject({ state: 'delivered' });
    ana.close();
    cora.close();
  });
});

describe('membership end (Review Focus 4)', () => {
  it('the open socket gets conversation:updated and hears nothing more from the old group', async () => {
    const [ben, gm] = [await open(people.ben.user), await signedIn(app, 'manager.unassigned')];
    const group = await groupOf(people.ben.agent);
    const [updated] = await Promise.all([next(ben, 'conversation:updated'), chat.endMembership(people.ben.user._id, [group.id])]);
    expect(updated).toMatchObject({ conversationId: group.id, canPost: false });
    const [after] = await Promise.all([next(ben, 'message:new'), gm.post(`/api/conversations/${group.id}/messages`).send({ body: 'After Ben left' }).expect(201)]);
    expect(after).toBeNull();
    ben.close();
  });
});
