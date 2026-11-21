import { countUnreadByUser, insertNotifications, listByUserCursor, markAllReadForUser, markReadForUser } from '../repositories/notification.repository.js';
import { findUserIdsByRole } from '../repositories/user.repository.js';
import { realtime } from '../sockets/realtime.js';
import { ROLES } from '../constants/permissions.js';
import { AppError } from '../utils/AppError.js';

/**
 * Store in-app notifications and push each to its user (`notification:new`).
 * @param {unknown[]} userIds
 * @param {{ type: 'order_status'|'order_new'|'system', title: string, body?: string, link?: string, data?: object }} content
 */
export async function notifyUsers(userIds, content) {
  if (!userIds.length) return [];
  const created = await insertNotifications(userIds.map((user) => ({ ...content, user })));
  for (const notification of created) realtime.toUser(notification.user, 'notification:new', notification);
  return created;
}

/** Notify every Kaluppa account. */
export const notifyKaluppa = async (content) => notifyUsers(await findUserIdsByRole(ROLES.KALUPPA), content);

/** @param {{ _id: unknown }} user @param {{ cursor?: string, limit: number }} page */
export const listMyNotifications = (user, page) => listByUserCursor(user._id, page);

export const countMyUnread = async (user) => ({ count: await countUnreadByUser(user._id) });

/** 404 for someone else's notification, so ids don't leak. */
export async function markRead(user, id) {
  const notification = await markReadForUser(user._id, id);
  if (!notification) throw new AppError(404, 'Notification not found.');
  return notification;
}

export const markAllRead = async (user) => ({ updated: await markAllReadForUser(user._id) });
