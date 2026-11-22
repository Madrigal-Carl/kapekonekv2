import { User } from '../models/user.model.js';

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
export async function findIdentityConflicts({ email, username }) {
  const found = await User.find({ $or: [{ email }, { username }] }, { email: 1, username: 1 }).lean();
  return { email: found.some((u) => u.email === email), username: found.some((u) => u.username === username) };
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
export async function replacePassword(userId, password) {
  const user = await User.findById(userId);
  if (!user) return null;
  user.password = password;
  user.tokenVersion += 1;
  return user.save();
}

/**
 * Seeder upsert by email. Existing users keep their password and profile.
 * @param {object} data includes an already-hashed `password`
 */
export const upsertSeedUser = ({ email, ...data }) =>
  User.updateOne({ email }, { $setOnInsert: { email, ...data } }, { upsert: true });

/** Users with any of the given emails (seeders). */
export const findUsersByEmails = (emails) => User.find({ email: { $in: emails } }).select('email firstName lastName contactNumber').lean();

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
