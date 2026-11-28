import { ContactMessage } from '../models/contactMessage.model.js';
import { pageList } from '../utils/pageList.js';

/** @param {object} fields */
export const createContactMessage = async (fields) => (await ContactMessage.create(fields)).toObject();

/**
 * Newest first. `q` is a RegExp matched against name, email, order number and message.
 * @param {{ q?: RegExp, topic?: string, page: number, limit: number }} query
 */
export function listContactMessages({ q, topic, page, limit }) {
  const filter = {
    ...(topic && { topic }),
    ...(q && { $or: [{ name: q }, { email: q }, { orderNumber: q }, { message: q }] }),
  };
  return pageList(ContactMessage.find(filter).sort({ createdAt: -1, _id: -1 }), { page, limit });
}

export const findContactMessageById = (id) => ContactMessage.findById(id).lean();
