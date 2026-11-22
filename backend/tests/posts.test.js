import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { Post, PostComment, User } = await import('../src/models/index.js');

const at = (minutes) => new Date(Date.UTC(2026, 10, 21, 0, minutes));
let post;
let firstComment;

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  const [kaluppa, farmer, manager] = await Promise.all(['kaluppa', 'farmer.approved', 'manager.santacruz'].map((e) => User.findOne({ email: `kapekonek.${e}@gmail.com` })));
  const posts = await Post.insertMany([
    { author: farmer._id, body: 'Oldest', createdAt: at(1) },
    { author: kaluppa._id, body: 'Fresh Liberica roasts are in!', media: [{ type: 'image', url: 'https://img/1.jpg' }, { type: 'video', url: 'https://vid/1.mp4', posterUrl: 'https://img/p.jpg', durationSec: 42 }], reactionCounts: { like: 15, love: 7, celebrate: 2 }, commentCount: 4, createdAt: at(5) },
    { author: farmer._id, body: 'Drafted', isPublished: false, createdAt: at(9) },
    { author: farmer._id, body: 'Removed', deletedAt: at(10), createdAt: at(8) },
    { author: manager._id, body: 'Group news', createdAt: at(3) },
    { author: farmer._id, body: 'Picking season', createdAt: at(4) },
  ], { timestamps: false });
  post = posts[1];
  const comments = await PostComment.insertMany([
    { post: post._id, author: farmer._id, body: 'First!', replyCount: 3, reactionCount: 5, createdAt: at(20) },
    { post: post._id, author: manager._id, body: 'Second', createdAt: at(21) },
    { post: post._id, author: farmer._id, body: 'Third', createdAt: at(22) },
  ], { timestamps: false });
  firstComment = comments[0];
  await PostComment.insertMany([1, 2, 3].map((i) => ({ post: post._id, author: kaluppa._id, parent: firstComment._id, body: `Reply ${i}`, createdAt: at(30 + i) })), { timestamps: false });
});
afterAll(stopMemoryDb);

describe('posts', () => {
  it('GET /posts/latest returns the newest published, undeleted posts with author cards', async () => {
    const res = await request(app).get('/api/posts/latest?limit=3');
    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.body)).toEqual(['Fresh Liberica roasts are in!', 'Picking season', 'Group news']);
    expect(res.body.data[0].author).toEqual({ _id: expect.any(String), name: 'Kaluppa', initials: 'KP', role: 'kaluppa', roleLabel: 'Kaluppa', avatarUrl: null });
    expect(res.body.data[1].author).toMatchObject({ name: 'Rodel M.', initials: 'RM', roleLabel: 'Farmer' });
  });

  it('GET /posts/:id returns the post with media and counts; hidden posts 404', async () => {
    const res = await request(app).get(`/api/posts/${post._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ body: 'Fresh Liberica roasts are in!', reactionCounts: { like: 15, love: 7, celebrate: 2 }, commentCount: 4 });
    expect(res.body.data.media[1]).toMatchObject({ type: 'video', durationSec: 42, posterUrl: 'https://img/p.jpg' });
    const drafted = await Post.findOne({ body: 'Drafted' });
    expect((await request(app).get(`/api/posts/${drafted._id}`)).status).toBe(404);
  });

  it('GET /posts/:id/comments pages top-level comments, each with up to 2 replies and replyCount', async () => {
    const page1 = await request(app).get(`/api/posts/${post._id}/comments?limit=2`);
    expect(page1.body.data.map((c) => c.body)).toEqual(['First!', 'Second']);
    const [first] = page1.body.data;
    expect(first).toMatchObject({ replyCount: 3, reactionCount: 5, author: { name: 'Rodel M.' } });
    expect(first.replies.map((r) => r.body)).toEqual(['Reply 1', 'Reply 2']);
    expect(first.repliesNextCursor).toEqual(expect.any(String));
    expect(page1.body.meta.hasMore).toBe(true);
    const page2 = await request(app).get(`/api/posts/${post._id}/comments?limit=2&cursor=${page1.body.meta.nextCursor}`);
    expect(page2.body.data.map((c) => c.body)).toEqual(['Third']);
    expect(page2.body.data[0].repliesNextCursor).toBeNull();
  });

  it('GET /comments/:id/replies continues from the cursor', async () => {
    const first = (await request(app).get(`/api/posts/${post._id}/comments?limit=1`)).body.data[0];
    const res = await request(app).get(`/api/comments/${firstComment._id}/replies?cursor=${first.repliesNextCursor}`);
    expect(res.body.data.map((r) => r.body)).toEqual(['Reply 3']);
    expect(res.body.meta.hasMore).toBe(false);
  });

  it('has no write endpoints in Phase 1', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ identifier: 'kapekonek.kaluppa@gmail.com', password: 'KapeKonek@123' });
    expect((await agent.post('/api/posts').send({ body: 'x' })).status).toBe(404);
    expect((await agent.post(`/api/posts/${post._id}/comments`).send({ body: 'x' })).status).toBe(404);
    expect((await agent.post(`/api/posts/${post._id}/reactions`).send({ type: 'like' })).status).toBe(404);
  });
});
