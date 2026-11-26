import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { signedIn } from './helpers/farmers.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
// Uploads are 400 KB jpgs; `clip*` is a 12 s mp4 video (stored as a video resource), `huge` a 60 MB video.
vi.mock('../src/clients/cloudinary.client.js', () => ({
  getUploadedAsset: async (publicId, resourceType) => {
    const name = publicId.split('/').pop();
    if (name.startsWith('clip') || name === 'huge') {
      if (resourceType !== 'video') return null;
      return { bytes: name === 'huge' ? 60 * 1024 * 1024 : 9_000_000, format: 'mp4', resourceType: 'video', originalFilename: name, width: 1280, height: 720, duration: 12.4 };
    }
    return { bytes: 400_000, format: 'jpg', resourceType: 'image', originalFilename: name, width: 900, height: 1600 };
  },
  destroyImage: async () => {},
}));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { Notification, Post, PostView, User } = await import('../src/models/index.js');
const { recordView, refreshTopPosts } = await import('../src/services/post.service.js');

let kaluppa, manager, farmer, other, buyer;
const ids = {};
const media = (userId, name, kind = 'image') => ({
  url: `https://res.cloudinary.com/test/${kind}/upload/v1/kapekonek/post-media/${userId}/${name}.${kind === 'video' ? 'mp4' : 'jpg'}`,
  publicId: `kapekonek/post-media/${userId}/${name}`,
});
const publish = (agent, body) => agent.post('/api/hub/posts').send(typeof body === 'string' ? { body } : body);
const feed = async (agent, query = '') => (await agent.get(`/api/hub/posts${query}`).expect(200)).body;
const notificationsOf = (handle, type) => Notification.find({ user: ids[handle], type }).lean();

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  for (const handle of ['kaluppa', 'manager.santacruz', 'farmer.approved', 'manager.unassigned', 'buyer']) ids[handle] = String((await User.findOne({ username: handle }))._id);
  [kaluppa, manager, farmer, other, buyer] = await Promise.all(['kaluppa', 'manager.santacruz', 'farmer.approved', 'manager.unassigned', 'buyer'].map((h) => signedIn(app, h)));
});
afterAll(stopMemoryDb);

describe('Hub posts', () => {
  it('posts text, up to 3 tags from the list and own photos or videos; a video gets a poster', async () => {
    const res = await publish(farmer, {
      body: 'First pruning done.', tags: ['pruning', 'soil'],
      media: [media(ids['farmer.approved'], 'before'), media(ids['farmer.approved'], 'clip', 'video')],
    }).expect(201);
    expect(res.body.data).toMatchObject({
      body: 'First pruning done.', tags: ['pruning', 'soil'], viewCount: 0, myReaction: null, isTop: false,
      author: { name: 'Rodel Mendoza', roleLabel: 'Farmer' },
    });
    expect(res.body.data.media[0]).toMatchObject({ type: 'image', width: 900, height: 1600 });
    expect(res.body.data.media[1]).toMatchObject({ type: 'video', durationSec: 12, posterUrl: expect.stringMatching(/\/video\/upload\/so_0\/.*clip\.jpg$/) });
  });

  it('refuses bad tags, 11 media, someone else’s upload and a video over 50 MB', async () => {
    expect((await publish(farmer, { body: 'x', tags: ['pruning', 'soil', 'advisory', 'harvesting'] }).expect(400)).body.errors.tags).toBe('Pick up to 3 tags');
    expect((await publish(farmer, { body: 'x', tags: ['gossip'] }).expect(400)).body.errors).toHaveProperty(['tags.0']);
    expect((await publish(farmer, { body: 'x', media: Array.from({ length: 11 }, (_, i) => media(ids['farmer.approved'], `p${i}`)) }).expect(400)).body.errors.media).toBe('Add up to 10 photos or videos');
    expect((await publish(farmer, { body: 'x', media: [media(ids.kaluppa, 'theirs')] }).expect(400)).body.errors.media).toBe('Upload these photos or videos again.');
    expect((await publish(farmer, { body: 'x', media: [media(ids['farmer.approved'], 'huge', 'video')] }).expect(422)).body.code).toBe('FILE_TOO_LARGE');
    expect((await publish(farmer, { body: ' ' }).expect(400)).body.errors.body).toBe('Write something to post');
  });

  it('buyers can’t read the Hub, post, react or comment', async () => {
    const post = (await publish(manager, 'Group meeting on Saturday.').expect(201)).body.data;
    await buyer.get('/api/hub/posts').expect(403);
    await publish(buyer, 'Hello').expect(403);
    await buyer.put(`/api/posts/${post._id}/reaction`).send({ type: 'like' }).expect(403);
    await buyer.post(`/api/posts/${post._id}/comments`).send({ body: 'Hi' }).expect(403);
    await request(app).get('/api/hub/posts').expect(401);
  });

  it('only the author edits or deletes; editing keeps media already on the post', async () => {
    const post = (await publish(farmer, { body: 'Typo here', tags: ['harvesting'], media: [media(ids['farmer.approved'], 'keep')] }).expect(201)).body.data;
    await manager.patch(`/api/hub/posts/${post._id}`).send({ body: 'Hijack', tags: [] }).expect(403);
    await manager.delete(`/api/hub/posts/${post._id}`).expect(403);
    const edited = (await farmer.patch(`/api/hub/posts/${post._id}`).send({ body: 'Fixed', tags: ['processing'], media: post.media }).expect(200)).body.data;
    expect(edited).toMatchObject({ body: 'Fixed', tags: ['processing'], editedAt: expect.any(String) });
    expect(edited.media).toEqual(post.media);
    await farmer.delete(`/api/hub/posts/${post._id}`).expect(200);
    expect((await feed(farmer)).data.some((p) => p._id === post._id)).toBe(false);
    await farmer.patch(`/api/hub/posts/${post._id}`).send({ body: 'Back?' }).expect(404);
  });

  it('a Group Manager can’t remove others’ posts; Kaluppa removes with a reason, the post leaves the feed and the author is told', async () => {
    const post = (await publish(farmer, 'Selling beans outside KapeKonek, message me').expect(201)).body.data;
    await manager.post(`/api/hub/posts/${post._id}/remove`).send({ reason: 'Not allowed here' }).expect(403);
    await kaluppa.post(`/api/hub/posts/${post._id}/remove`).send({ reason: 'x' }).expect(400);
    await kaluppa.post(`/api/hub/posts/${post._id}/remove`).send({ reason: 'Selling outside KapeKonek isn’t allowed in the Hub' }).expect(200);
    expect((await feed(manager)).data.some((p) => p._id === post._id)).toBe(false);
    await farmer.get(`/api/posts/${post._id}`).expect(404);
    const [note] = await notificationsOf('farmer.approved', 'post_removed');
    expect(note).toMatchObject({ title: 'Kaluppa removed your post', body: expect.stringContaining('Selling outside KapeKonek isn’t allowed in the Hub') });
    expect(await Post.findById(post._id).lean()).toMatchObject({ removalReason: 'Selling outside KapeKonek isn’t allowed in the Hub', removedBy: expect.anything() });
  });

  it('filters the feed by tag, pages by cursor and counts posts per tag', async () => {
    for (const n of [1, 2, 3]) await publish(other, { body: `Soil tip ${n}`, tags: ['soil'] }).expect(201);
    const page1 = await feed(other, '?tag=soil&limit=2');
    expect(page1.data.map((p) => p.body)).toEqual(['Soil tip 3', 'Soil tip 2']);
    expect(page1.meta.hasMore).toBe(true);
    const page2 = await feed(other, `?tag=soil&limit=2&cursor=${page1.meta.nextCursor}`);
    expect(page2.data.map((p) => p.body)).toEqual(['Soil tip 1', 'First pruning done.']);
    const tags = (await other.get('/api/hub/tags').expect(200)).body.data;
    expect(tags.find((t) => t.tag === 'soil').count).toBe(4);
    expect(tags.map((t) => t.tag)).toEqual(['pruning', 'harvesting', 'processing', 'soil', 'advisory', 'announcement']);
  });
});

describe('reactions and comments', () => {
  let post;
  beforeAll(async () => {
    post = (await publish(manager, { body: 'Leaf rust is showing up.', tags: ['advisory'] }).expect(201)).body.data;
  });
  const reloaded = async (agent) => (await agent.get(`/api/posts/${post._id}`).expect(200)).body.data;

  it('a reaction switches type without double counting and can be taken back; the author is told once', async () => {
    await farmer.put(`/api/posts/${post._id}/reaction`).send({ type: 'like' }).expect(200);
    await farmer.put(`/api/posts/${post._id}/reaction`).send({ type: 'love' }).expect(200);
    expect(await reloaded(farmer)).toMatchObject({ myReaction: 'love', reactionCounts: { like: 0, love: 1, celebrate: 0 } });
    await farmer.delete(`/api/posts/${post._id}/reaction`).expect(200);
    expect(await reloaded(farmer)).toMatchObject({ myReaction: null, reactionCounts: { like: 0, love: 0, celebrate: 0 } });
    await manager.put(`/api/posts/${post._id}/reaction`).send({ type: 'like' }).expect(200); // own post: no notification
    expect(await notificationsOf('manager.santacruz', 'post_activity')).toHaveLength(1);
  });

  it('comments with one level of replies; counts follow; authors edit and delete their own', async () => {
    const comment = (await farmer.post(`/api/posts/${post._id}/comments`).send({ body: 'Does copper help?' }).expect(201)).body.data;
    const reply = (await manager.post(`/api/posts/${post._id}/comments`).send({ body: 'Prune first.', parentId: comment._id }).expect(201)).body.data;
    await farmer.post(`/api/posts/${post._id}/comments`).send({ body: 'Nested', parentId: reply._id }).expect(400);
    expect((await reloaded(farmer)).commentCount).toBe(2);
    expect((await notificationsOf('farmer.approved', 'post_activity')).map((n) => n.title)).toContain('Liza Ramos replied to your comment');

    await manager.patch(`/api/comments/${comment._id}`).send({ body: 'Hijack' }).expect(403);
    expect((await farmer.patch(`/api/comments/${comment._id}`).send({ body: 'Does copper fungicide help?' }).expect(200)).body.data).toMatchObject({ body: 'Does copper fungicide help?', editedAt: expect.any(String) });

    await kaluppa.put(`/api/comments/${comment._id}/reaction`).send({ type: 'like' }).expect(200);
    const [listed] = (await kaluppa.get(`/api/posts/${post._id}/comments`).expect(200)).body.data;
    expect(listed).toMatchObject({ reactionCount: 1, liked: true, replyCount: 1, replies: [{ body: 'Prune first.', liked: false }] });

    await farmer.delete(`/api/comments/${comment._id}`).expect(200);
    expect((await reloaded(farmer)).commentCount).toBe(0);
  });

  it('Kaluppa removes a comment with a reason and its author is told; a Group Manager can’t', async () => {
    const comment = (await farmer.post(`/api/posts/${post._id}/comments`).send({ body: 'Buy my seedlings, DM me' }).expect(201)).body.data;
    await manager.post(`/api/comments/${comment._id}/remove`).send({ reason: 'Not allowed here' }).expect(403);
    await kaluppa.post(`/api/comments/${comment._id}/remove`).send({ reason: 'Selling isn’t allowed in comments' }).expect(200);
    expect((await reloaded(farmer)).commentCount).toBe(0);
    expect((await notificationsOf('farmer.approved', 'post_removed')).map((n) => n.title)).toContain('Kaluppa removed your comment');
  });
});

describe('views and the top 3', () => {
  it('counts a signed-in person once a day; guests aren’t counted', async () => {
    const post = (await publish(kaluppa, 'Fresh roasts are in.').expect(201)).body.data;
    await request(app).post(`/api/hub/posts/${post._id}/view`).expect(401);
    expect((await farmer.post(`/api/hub/posts/${post._id}/view`).expect(200)).body.data).toEqual({ counted: true });
    expect((await farmer.post(`/api/hub/posts/${post._id}/view`).expect(200)).body.data).toEqual({ counted: false });
    const user = await User.findById(ids['farmer.approved']).lean();
    await recordView(user, post._id, new Date(Date.now() + 86_400_000)); // tomorrow counts again
    expect((await Post.findById(post._id).lean()).viewCount).toBe(2);
    expect(await PostView.countDocuments({ post: post._id })).toBe(2);
  });

  it('ranks the last 30 days of views, is idempotent, and drops a removed post', async () => {
    await PostView.deleteMany({});
    const make = async (body) => (await publish(kaluppa, body).expect(201)).body.data._id;
    const [a, b, c, d] = [await make('A'), await make('B'), await make('C'), await make('D')];
    const today = new Date();
    const viewers = Object.values(ids);
    const day = (offset) => new Date(today.getTime() - offset * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).replaceAll('-', '');
    await PostView.insertMany([
      ...viewers.slice(0, 4).map((user) => ({ post: b, user, day: day(1) })),
      ...viewers.slice(0, 3).map((user) => ({ post: a, user, day: day(0) })),
      ...viewers.slice(0, 2).map((user) => ({ post: c, user, day: day(29) })),
      ...viewers.map((user) => ({ post: d, user, day: day(30) })), // older than 30 days
    ]);
    const first = await refreshTopPosts(today);
    expect(first).toEqual([{ id: b, views: 4 }, { id: a, views: 3 }, { id: c, views: 2 }]);
    expect(await refreshTopPosts(today)).toEqual(first);
    const top = (await request(app).get('/api/posts/top').expect(200)).body.data;
    expect(top.map((p) => [p.body, p.views])).toEqual([['B', 4], ['A', 3], ['C', 2]]);
    expect((await feed(farmer)).data.find((p) => p._id === b).isTop).toBe(true);

    await kaluppa.post(`/api/hub/posts/${b}/remove`).send({ reason: 'Duplicate of another post' }).expect(200);
    expect((await request(app).get('/api/posts/top').expect(200)).body.data.map((p) => p.body)).toEqual(['A', 'C']);
  });
});
