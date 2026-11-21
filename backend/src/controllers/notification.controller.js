import * as notifications from '../services/notification.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await notifications.listMyNotifications(req.user, req.query);
  sendSuccess(res, { data: items, meta });
});

export const unreadCount = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await notifications.countMyUnread(req.user) });
});

export const markRead = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await notifications.markRead(req.user, req.params.id) });
});

export const markAllRead = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'All notifications marked as read.', data: await notifications.markAllRead(req.user) });
});
