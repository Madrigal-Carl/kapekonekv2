import { Notification } from '../models/notification.model.js';

/** @param {Array<{ user: unknown, type: string, title: string, body?: string, link?: string, data?: object }>} notifications */
export const insertNotifications = async (notifications) => (await Notification.insertMany(notifications)).map((n) => n.toObject());
