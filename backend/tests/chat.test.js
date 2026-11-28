import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

const chat = await import('../src/services/chat.service.js');
const { Conversation, ConversationMember } = await import('../src/models/index.js');

beforeAll(async () => {
  await startMemoryDb();
  await Promise.all([Conversation.syncIndexes(), ConversationMember.syncIndexes()]);
});
afterAll(stopMemoryDb);

const oid = () => new mongoose.Types.ObjectId();
const [ana, ben, carl] = [oid(), oid(), oid()];
const association = oid();

describe('chat memberships', () => {
  it('creates one Kaluppa chat per user, with the Kaluppa team as a member', async () => {
    const first = await chat.ensureKaluppaChat(ana);
    const again = await chat.ensureKaluppaChat(ana);
    expect(String(again._id)).toBe(String(first._id));
    expect(await Conversation.countDocuments({ type: 'kaluppa' })).toBe(1);
    const members = await ConversationMember.find({ conversation: first._id }).lean();
    expect(members.map((m) => [m.user && String(m.user), m.team, m.canPost]).sort()).toEqual([[null, 'kaluppa', true], [String(ana), null, true]].sort());
  });

  it('keeps one group chat per association and adds members once', async () => {
    const group = await chat.joinGroup(ana, association);
    await chat.joinGroup(ana, association);
    await chat.joinGroup(ben, association);
    expect(String((await chat.ensureGroupChat(association))._id)).toBe(String(group._id));
    expect(await ConversationMember.countDocuments({ conversation: group._id })).toBe(2);
  });

  it('ending a membership keeps the row, read-only; joining again reopens it', async () => {
    const group = await chat.ensureGroupChat(association);
    await chat.endMembership(ben, [group._id]);
    const ended = await ConversationMember.findOne({ conversation: group._id, user: ben }).lean();
    expect(ended).toMatchObject({ canPost: false });
    expect(ended.leftAt).toBeInstanceOf(Date);

    await chat.joinGroup(ben, association);
    expect(await ConversationMember.findOne({ conversation: group._id, user: ben }).lean()).toMatchObject({ canPost: true, leftAt: null });
  });

  it('ends direct chats between a user and the people they leave, on both sides', async () => {
    const direct = await Conversation.create({ type: 'direct', pairKey: chat.directKey(carl, ana) });
    await ConversationMember.create([{ conversation: direct._id, user: ana }, { conversation: direct._id, user: carl }]);
    await chat.endDirectChatsBetween(ana, [carl, ben]);
    const members = await ConversationMember.find({ conversation: direct._id }).lean();
    expect(members.every((m) => m.canPost === false && m.leftAt)).toBe(true);
    expect((await ConversationMember.findOne({ user: ana, team: null, conversation: (await chat.ensureKaluppaChat(ana))._id })).canPost).toBe(true);
  });
});
