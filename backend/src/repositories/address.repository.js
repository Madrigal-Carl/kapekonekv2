import { Address } from '../models/address.model.js';

const active = (userId) => ({ user: userId, deletedAt: null });

/** The user's active addresses, default first, then newest. */
export const listActiveByUser = (userId) => Address.find(active(userId)).sort({ isDefault: -1, createdAt: -1, _id: -1 }).lean();

export const countActiveByUser = (userId) => Address.countDocuments(active(userId));

/** One active address of this user, or null. */
export const findActiveForUser = (id, userId) => Address.findOne({ _id: id, ...active(userId) }).lean();

/** @param {object} data */
export const createAddress = async (data) => (await Address.create(data)).toObject();

/**
 * Replace the editable fields; a `location` of null removes the pin.
 * @returns {Promise<object|null>} the updated address, or null if it isn't the user's active address
 */
export const updateAddressForUser = (id, userId, { location, ...fields }) =>
  Address.findOneAndUpdate(
    { _id: id, ...active(userId) },
    location ? { $set: { ...fields, location } } : { $set: fields, $unset: { location: 1 } },
    { returnDocument: 'after' },
  ).lean();

/** Make `id` the only default among the user's active addresses. */
export async function setDefaultForUser(id, userId) {
  await Address.updateMany({ ...active(userId), _id: { $ne: id }, isDefault: true }, { isDefault: false });
  return Address.findOneAndUpdate({ _id: id, ...active(userId) }, { isDefault: true }, { returnDocument: 'after' }).lean();
}

/** Soft delete. @returns {Promise<object|null>} the address as it was, or null */
export const softDeleteForUser = (id, userId) =>
  Address.findOneAndUpdate({ _id: id, ...active(userId) }, { deletedAt: new Date(), isDefault: false }).lean();

/** The newest active address (promoted when the default is deleted). */
export const findNewestActive = (userId) => Address.findOne(active(userId)).sort({ createdAt: -1, _id: -1 }).lean();

/** Bulk insert (seeder). */
export const insertAddresses = (addresses) => Address.insertMany(addresses);

export const countAddresses = () => Address.countDocuments();
