import { createHash, randomBytes, randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { BCRYPT_ROUNDS } from '../models/user.model.js';
import { TOKEN_PURPOSES } from '../models/token.model.js';
import { EMAIL_JOBS } from '../queues/email.jobs.js';
import { enqueueEmail } from '../queues/email.queue.js';
import { consumeToken, createToken, deleteUnusedTokens } from '../repositories/token.repository.js';
import {
  createUser,
  findByIdentifierWithPassword,
  findIdentityConflicts,
  findTakenUsernames,
  findUserByEmail,
  findUserById,
  markEmailVerified,
  replacePassword,
  setFirstPassword,
  touchLastLogin,
} from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken, verifyRefreshToken } from '../utils/tokens.js';
import { resolvePermissions } from './permission.service.js';

const VERIFY_TTL_MS = 60 * 60 * 1000; // VerifyEmail.dc.html: "The link works for 60 minutes"
const RESET_TTL_MS = 60 * 60 * 1000;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const expired = () => new AppError(401, 'Your session has expired. Please log in again.');

/** The user fields the frontend may see. */
export const publicUser = (user) => ({
  id: String(user._id),
  firstName: user.firstName,
  middleName: user.middleName ?? null,
  lastName: user.lastName,
  fullName: user.fullName,
  initials: user.initials,
  username: user.username,
  email: user.email ?? null,
  emailVerifiedAt: user.emailVerifiedAt ?? null,
  contactNumber: user.contactNumber ?? null,
  avatar: user.avatar?.url ? { url: user.avatar.url } : null,
  roles: user.roles,
  mustChangePassword: Boolean(user.mustChangePassword),
  createdAt: user.createdAt,
});

/**
 * The `/auth/me` payload.
 * @returns {Promise<{ user: object, roles: string[], permissions: string[] }>}
 */
export async function buildSession(user) {
  return { user: publicUser(user), roles: user.roles, permissions: await resolvePermissions(user) };
}

/**
 * Load the user behind an access token. Tokens issued before a password change are refused.
 * @throws {AppError} 401 expired/invalid, 403 suspended
 */
export async function userFromAccessToken(token) {
  const { sub, tv } = verifyAccessToken(token);
  const user = await findUserById(sub);
  if (!user || user.tokenVersion !== tv) throw expired();
  if (user.status !== 'active') throw new AppError(403, 'This account is suspended. Contact Kaluppa for help.');
  return user;
}

async function issueLink(user, purpose, ttlMs) {
  const raw = randomBytes(32).toString('hex');
  await deleteUnusedTokens(user._id, purpose);
  await createToken({ user: user._id, purpose, tokenHash: sha256(raw), email: user.email, expiresAt: new Date(Date.now() + ttlMs) });
  return raw;
}

/** Email a fresh verification link to the user's current address. */
export async function sendVerificationEmail(user) {
  const token = await issueLink(user, TOKEN_PURPOSES.VERIFY_EMAIL, VERIFY_TTL_MS);
  await enqueueEmail(EMAIL_JOBS.VERIFY_EMAIL, {
    to: user.email,
    name: user.firstName,
    url: `${env.CLIENT_URL}/verify-email/confirm?token=${token}`,
  });
}

/**
 * Create a buyer or farmer account and email a verification link.
 * @param {{ firstName: string, middleName: string|null, lastName: string, username: string, email: string, password: string, role: string }} input
 */
export async function register({ role, ...fields }) {
  const conflicts = await findIdentityConflicts(fields);
  if (conflicts.email || conflicts.username) {
    throw new AppError(409, 'Some details are already in use.', {
      errors: {
        ...(conflicts.email && { email: 'Email is already taken' }),
        ...(conflicts.username && { username: 'Username is already taken' }),
      },
    });
  }
  const user = await createUser({ ...fields, roles: [role] });
  await sendVerificationEmail(user);
  return { user, session: await buildSession(user) };
}

let dummyHash;

/**
 * Check credentials. The error never says which part was wrong.
 * @param {{ identifier: string, password: string, remember: boolean }} input
 */
export async function login({ identifier, password, remember }) {
  const user = await findByIdentifierWithPassword(identifier);
  // Compare against a dummy hash for unknown users so response time doesn't reveal which accounts exist.
  dummyHash ??= await bcrypt.hash('kapekonek-dummy', BCRYPT_ROUNDS);
  const ok = await bcrypt.compare(password, user?.password ?? dummyHash);
  if (!user || !ok) throw new AppError(401, 'The email, username or password is incorrect.');
  if (user.status !== 'active') throw new AppError(403, 'This account is suspended. Contact Kaluppa for help.');
  await touchLastLogin(user._id);
  return { user, remember, session: await buildSession(user) };
}

/**
 * Exchange a refresh token for new cookies. Tokens from before a password change are refused.
 * @param {string | undefined} token
 */
export async function refresh(token) {
  if (!token) throw expired();
  const { sub, tv, rem } = verifyRefreshToken(token);
  const user = await findUserById(sub);
  if (!user || user.tokenVersion !== tv || user.status !== 'active') throw expired();
  return { user, remember: Boolean(rem), session: await buildSession(user) };
}

/** Mark the email verified with a single-use link. */
export async function verifyEmail({ token }) {
  const record = await consumeToken(sha256(token), TOKEN_PURPOSES.VERIFY_EMAIL);
  if (!record) {
    throw new AppError(400, 'This verification link has expired or was already used.', { errors: { token: 'Link expired or used' } });
  }
  await markEmailVerified(record.user, record.email);
}

/** Send a fresh verification link; older links stop working. */
export async function resendVerification(user) {
  if (user.emailVerifiedAt) throw new AppError(409, 'Your email is already verified.');
  await sendVerificationEmail(user);
}

/** Email a reset link if the account exists. The response is the same either way. */
export async function forgotPassword({ email }) {
  const user = await findUserByEmail(email);
  if (!user || user.status !== 'active') return;
  const token = await issueLink(user, TOKEN_PURPOSES.RESET_PASSWORD, RESET_TTL_MS);
  await enqueueEmail(EMAIL_JOBS.RESET_PASSWORD, {
    to: user.email,
    name: user.firstName,
    url: `${env.CLIENT_URL}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`,
  });
}

/** Set a new password with a single-use link and sign out every other session. */
export async function resetPassword({ token, password }) {
  const record = await consumeToken(sha256(token), TOKEN_PURPOSES.RESET_PASSWORD);
  const user = record && (await replacePassword(record.user, password));
  if (!user) {
    throw new AppError(400, 'This reset link has expired or was already used.', { errors: { token: 'Link expired or used' } });
  }
}

/**
 * First sign-in of an account a Group Manager created: replace the temporary password. Other sessions end.
 * @throws {AppError} 409 when the account has no temporary password to replace
 */
export async function setFirstPasswordFor(user, { newPassword }) {
  const updated = await setFirstPassword(user._id, newPassword);
  if (!updated) throw new AppError(409, 'Your password is already set. Change it from Account settings.');
  return { user: updated, session: await buildSession(updated) };
}

/** @param {{ username: string }} query */
export async function usernameAvailability({ username }) {
  const [taken] = await findTakenUsernames([username]);
  return { username, available: !taken };
}

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const validUsername = (u) => /^[a-z0-9._]{3,30}$/.test(u);

/**
 * Three available usernames built from the person's name, e.g. Juana Dela Cruz → juanadc, juana.dc, jdelacruz.
 * @param {{ firstName: string, lastName: string }} query
 * @returns {Promise<string[]>}
 */
export async function usernameSuggestions({ firstName, lastName }) {
  const first = slug(firstName.split(/\s+/)[0] ?? '') || 'kape';
  const lastWords = lastName.split(/\s+/).map(slug).filter(Boolean);
  const last = lastWords.join('') || 'konek';
  const initials = lastWords.map((w) => w[0]).join('') || 'k';
  const named = [`${first}${initials}`, `${first}.${initials}`, `${first[0]}${last}`, `${first}.${last}`, `${first}_${initials}`, `${first}${last}`];

  const picked = [];
  for (let round = 0; picked.length < 3 && round < 5; round += 1) {
    const pool = round === 0 ? named : Array.from({ length: 6 }, () => `${first}${initials}${randomInt(10, 1000)}`);
    const fresh = [...new Set(pool.map((u) => u.slice(0, 30)))].filter((u) => validUsername(u) && !picked.includes(u));
    const taken = new Set(await findTakenUsernames(fresh));
    picked.push(...fresh.filter((u) => !taken.has(u)).slice(0, 3 - picked.length));
  }
  return picked;
}
