import { User } from '../models/user.model.js';
import { pageList } from '../utils/pageList.js';

/** @param {unknown} id */
export const findUserById = (id) => User.findById(id);

/**
 * Find a user by email or username, with the password hash.
 * @param {string} identifier already lowercased
 */
export const findByIdentifierWithPassword = (identifier) =>
  User.findOne(identifier.includes('@') ? { email: identifier } : { username: identifier }).select('+password');

/** @param {string} email lowercased */
export const findUserByEmail = (email) => User.findOne({ email });

/**
 * Which of these usernames are taken.
 * @param {string[]} usernames
 * @returns {Promise<string[]>}
 */
export const findTakenUsernames = async (usernames) =>
  (await User.find({ username: { $in: usernames } }, { username: 1 }).lean()).map((u) => u.username);

/**
 * Which unique fields already belong to someone.
 * @param {{ email: string, username: string }} fields
 * @returns {Promise<{ email: boolean, username: boolean }>}
 */
export async function findIdentityConflicts({ email, username }, exceptId = null) {
  const found = await User.find({ $or: [email && { email }, { username }].filter(Boolean), ...(exceptId && { _id: { $ne: exceptId } }) }, { email: 1, username: 1 }).lean();
  return { email: Boolean(email) && found.some((u) => u.email === email), username: found.some((u) => u.username === username) };
}

/** Create a user; the model hashes the password. */
export const createUser = (data) => User.create(data);

/** Verify the email only if it is still the address the link was sent to. */
export const markEmailVerified = (userId, email) =>
  User.updateOne({ _id: userId, email, emailVerifiedAt: null }, { emailVerifiedAt: new Date() });

export const touchLastLogin = (userId) => User.updateOne({ _id: userId }, { lastLoginAt: new Date() });

/**
 * Set a new password and bump tokenVersion, which signs out every refresh token.
 * @returns {Promise<import('mongoose').Document | null>}
 */
/**
 * Set the first password of an account flagged `mustChangePassword`, clear the flag and end other sessions.
 * @returns {Promise<object|null>} null when the account isn't flagged
 */
export async function setFirstPassword(userId, password) {
  const user = await User.findOne({ _id: userId, mustChangePassword: true });
  if (!user) return null;
  user.password = password;
  user.mustChangePassword = false;
  user.passwordIsDefault = false;
  user.tokenVersion += 1;
  return user.save();
}

export async function replacePassword(userId, password) {
  const user = await User.findById(userId);
  if (!user) return null;
  user.password = password;
  user.passwordIsDefault = false;
  user.tokenVersion += 1;
  return user.save();
}

/**
 * Seeder upsert by email. Existing users keep their password and profile.
 * @param {object} data includes an already-hashed `password`
 */
export const upsertSeedUser = ({ username, ...data }) =>
  User.updateOne({ username }, { $setOnInsert: { username, ...data, isSeed: true } }, { upsert: true });

/** Users with any of the given usernames (seeders: seed usernames are their handles). */
export const findUsersByUsernames = (usernames) =>
  User.find({ username: { $in: usernames } }).select('username email firstName lastName contactNumber roles avatar').lean();

/** Whether an address belongs to a seeded account (the mail worker skips those). */
export const isSeedEmail = async (email) => Boolean(await User.exists({ email: email?.toLowerCase(), isSeed: true }));

export const countUsers = () => User.countDocuments();

/** Ids of active users holding a role (e.g. every Kaluppa account). */
export const findUserIdsByRole = async (role) => (await User.find({ roles: role, status: 'active' }).select('_id').lean()).map((u) => u._id);

/** Save the phone a buyer gave at checkout to their profile. */
export const updateContactNumber = (userId, contactNumber) => User.updateOne({ _id: userId }, { contactNumber });

/** @param {unknown} id */
export const findByIdWithPassword = (id) => User.findById(id).select('+password');

const AFTER = { returnDocument: 'after', runValidators: true };

/**
 * Update name, username and phone. A taken username surfaces as a duplicate-key error (→ 409).
 * @param {{ firstName: string, middleName: string|null, lastName: string, username: string, contactNumber: string|null }} fields
 */
export const updateProfileFields = (userId, fields) => User.findByIdAndUpdate(userId, fields, AFTER);

/** @param {{ url: string, publicId: string } | null} avatar null removes it */
export const updateAvatar = (userId, avatar) =>
  User.findByIdAndUpdate(userId, avatar ? { avatar } : { $unset: { avatar: 1 } }, AFTER);

/** Switch to a new email; it must be verified again. */
export const replaceEmail = (userId, email) => User.findByIdAndUpdate(userId, { email, emailVerifiedAt: null }, AFTER);

/** Active accounts of a role that have an email, for notices (e.g. Kaluppa when an association has no Group Manager). */
export const findActiveRecipientsByRole = (role) =>
  User.find({ roles: role, status: 'active', email: { $ne: null } }, 'firstName email').lean();

/** Recipient fields of one account. */
/** First and last names of these users. */
export const findNamesByIds = (ids) => User.find({ _id: { $in: ids } }, 'firstName lastName').lean();

export const findRecipient = (id) => User.findById(id, 'firstName lastName email status contactNumber').lean();

/**
 * One page of these users (newest first); each search word must match a name or the username.
 * @param {{ ids: unknown[], words: RegExp[], page: number, limit: number }} query
 */
export const listUsersAmong = ({ ids, words, page, limit }) =>
  pageList(
    User.find({ _id: { $in: ids }, ...(words.length && { $and: words.map((w) => ({ $or: [{ firstName: w }, { lastName: w }, { username: w }] })) }) })
      .sort({ createdAt: -1, _id: -1 }),
    { page, limit },
  );

/** Reset to the default password: every session and refresh token ends (`tokenVersion`). */
export async function resetToDefaultPassword(userId, password) {
  const user = await User.findById(userId);
  user.password = password;
  user.passwordIsDefault = true;
  user.mustChangePassword = false;
  user.tokenVersion += 1;
  return user.save();
}

/** A username-only account adds its first email (unverified); null when it already has one. */
export const addFirstEmail = (userId, email) =>
  User.findOneAndUpdate({ _id: userId, email: null }, { $set: { email, emailVerifiedAt: null } }, { returnDocument: 'after' });

export const findGroupManagerById = (id) => User.findOne({ _id: id, roles: 'group_manager' }).lean();

/**
 * Page of Group Managers, newest first. Each search word must match a name or the username; `orIds` also match
 * (managers of associations whose name matches). `assignedIds` splits active from unassigned.
 * @param {{ words: RegExp[], orIds: unknown[], status?: 'active'|'unassigned'|'archived', assignedIds: unknown[], page: number, limit: number }} query
 */
export function listGroupManagers({ words, orIds, status, assignedIds, page, limit }) {
  const byWords = words.length && { $and: words.map((w) => ({ $or: [{ firstName: w }, { lastName: w }, { username: w }] })) };
  const filter = {
    roles: 'group_manager',
    ...(byWords && { $or: [byWords, { _id: { $in: orIds } }] }),
    ...(status === 'archived' && { status: 'suspended' }),
    ...(status === 'active' && { status: 'active', _id: { $in: assignedIds } }),
    ...(status === 'unassigned' && { status: 'active', _id: { $nin: assignedIds } }),
  };
  return pageList(User.find(filter).sort({ createdAt: -1, _id: -1 }), { page, limit });
}

/** Suspend (archive) or reactivate an account; suspending also ends every open session. */
export const setAccountStatus = (userId, status) =>
  User.findByIdAndUpdate(userId, { status, ...(status === 'suspended' && { $inc: { tokenVersion: 1 } }) }, { returnDocument: 'after' }).lean();

/** Ids of every user with the role, archived or not (orders keep their customer). */
export const findUserIdsWithRole = (role) => User.find({ roles: role }).distinct('_id');

/** Name, roles and phone of an order's customer. */
export const findCustomer = (id) => User.findById(id, 'firstName lastName roles contactNumber').lean();

/**
 * Ids of users whose name or username matches every word (searching records by person).
 * @param {RegExp[]} words
 */
export const findUserIdsByName = (words) =>
  User.find({ $and: words.map((w) => ({ $or: [{ firstName: w }, { lastName: w }, { username: w }] })) }).distinct('_id');

/**
 * Active farmers and Group Managers for the Inbox's people search, by name or username, A–Z.
 * @param {{ ids: unknown[]|null, words: RegExp[], limit: number }} q `ids` null = anyone
 */
export const findInboxContacts = ({ ids, words, limit }) =>
  User.find({
    roles: { $in: ['farmer', 'group_manager'] },
    status: 'active',
    ...(ids && { _id: { $in: ids } }),
    ...(words.length && { $and: words.map((w) => ({ $or: [{ firstName: w }, { lastName: w }, { username: w }] })) }),
  })
    .select('firstName lastName roles avatar')
    .sort({ firstName: 1, lastName: 1 })
    .limit(limit)
    .lean();
