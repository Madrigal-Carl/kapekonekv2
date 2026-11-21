import { Notification } from '../models/notification.model.js';
import { cursorFilter, cursorSort, pageResult } from '../utils/pagination.js';

const NEWEST = { sortField: 'createdAt', direction: 'desc' };

/** @param {Array<{ user: unknown, type: string, title: string, body?: string, link?: string, data?: object }>} notifications */
export const insertNotifications = async (notifications) => (await Notification.insertMany(notifications)).map((n) => n.toObject());

/** One user's notifications, newest first. */
export async function listByUserCursor(userId, { cursor, limit }) {
  const docs = await Notification.find({ $and: [{ user: userId }, cursorFilter({ ...NEWEST, cursor })] })
    .sort(cursorSort(NEWEST))
    .limit(limit + 1)
    .lean();
  return pageResult(docs, limit, NEWEST.sortField);
}

export const countUnreadByUser = (userId) => Notification.countDocuments({ user: userId, readAt: null });

/** Mark one of the user's notifications read (keeps the first read time); null when it isn't theirs. */
export const markReadForUser = async (userId, id) =>
  (await Notification.findOneAndUpdate({ _id: id, user: userId, readAt: null }, { $set: { readAt: new Date() } }, { returnDocument: 'after' }).lean()) ??
  Notification.findOne({ _id: id, user: userId }).lean();

export const markAllReadForUser = async (userId) => (await Notification.updateMany({ user: userId, readAt: null }, { $set: { readAt: new Date() } })).modifiedCount;
