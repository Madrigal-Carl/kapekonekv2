import { insertNotifications } from '../repositories/notification.repository.js';
import { findUserIdsByRole } from '../repositories/user.repository.js';
import { realtime } from '../sockets/realtime.js';
import { ROLES } from '../constants/permissions.js';

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
