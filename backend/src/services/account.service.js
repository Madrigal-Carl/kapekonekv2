import { destroyImage } from '../clients/cloudinary.client.js';
import { env } from '../config/env.js';
import { EMAIL_JOBS } from '../queues/email.jobs.js';
import { enqueueEmail } from '../queues/email.queue.js';
import {
  findByIdWithPassword,
  replaceEmail,
  replacePassword,
  updateAvatar,
  updateProfileFields,
} from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { verifyRefreshToken } from '../utils/tokens.js';
import { record } from './audit.service.js';
import { buildSession, publicUser, sendVerificationEmail } from './auth.service.js';
import { farmerEntity } from './farmerProfile.service.js';
import { assertUploadAllowed, isOwnUpload } from './upload.service.js';

const fieldError = (field, message) => new AppError(400, 'Please check the highlighted fields.', { errors: { [field]: message } });

async function assertPassword(user, currentPassword) {
  const withHash = await findByIdWithPassword(user._id);
  if (!withHash || !(await withHash.comparePassword(currentPassword))) {
    throw fieldError('currentPassword', 'Your current password is incorrect');
  }
}

/** @returns {object} the public user */
export const getProfile = (user) => publicUser(user);

/**
 * Update name, username and phone. Someone else's username → 409 (duplicate key).
 * @param {{ firstName: string, middleName: string|null, lastName: string, username: string, contactNumber: string|null }} fields
 */
export async function updateProfile(user, fields) {
  const after = await updateProfileFields(user._id, fields);
  // A farmer's contact number shows in their Group Manager's History (PHASE-2-SPEC §3.15); the farmer record is the user.
  if (user.roles.includes('farmer') && (user.contactNumber ?? null) !== (after.contactNumber ?? null)) {
    await record({ actor: user, area: 'farmers', action: 'contact', entity: farmerEntity(after), before: { contactNumber: user.contactNumber ?? null }, after: { contactNumber: after.contactNumber ?? null }, fields: ['contactNumber'] });
  }
  return publicUser(after);
}

/**
 * Point the avatar at a fresh upload from the user's own folder, then delete the old image.
 * @param {{ url: string, publicId: string }} avatar
 */
export async function setAvatar(user, avatar) {
  if (!isOwnUpload(user, 'avatar', avatar)) throw fieldError('avatar', 'Upload your photo again.');
  await assertUploadAllowed('avatar', avatar.publicId, 'avatar');
  const oldId = user.avatar?.publicId;
  const updated = await updateAvatar(user._id, avatar);
  if (oldId && oldId !== avatar.publicId) await destroyImage(oldId);
  return publicUser(updated);
}

/** Remove the avatar; the initials show again. */
export async function removeAvatar(user) {
  const updated = await updateAvatar(user._id, null);
  if (user.avatar?.publicId) await destroyImage(user.avatar.publicId);
  return publicUser(updated);
}

/**
 * Change the email after checking the password. The new address must be verified again;
 * the old address gets a notice.
 * @param {{ email: string, currentPassword: string }} input
 */
export async function changeEmail(user, { email, currentPassword }) {
  await assertPassword(user, currentPassword);
  if (email === user.email) throw fieldError('email', 'That is already your email');
  const updated = await replaceEmail(user._id, email);
  await sendVerificationEmail(updated);
  await enqueueEmail(EMAIL_JOBS.EMAIL_CHANGED_NOTICE, {
    to: user.email,
    name: updated.firstName,
    newEmail: email,
    url: `${env.CLIENT_URL}/forgot-password`,
  });
  return buildSession(updated);
}

/**
 * Change the password after checking the current one. tokenVersion goes up, which signs out every
 * other session; the controller re-issues this session's cookies with the same remember-me choice.
 * @param {{ currentPassword: string, password: string }} input
 * @param {string | undefined} refreshToken this session's refresh cookie
 */
export async function changePassword(user, { currentPassword, password }, refreshToken) {
  await assertPassword(user, currentPassword);
  let remember = false;
  try {
    remember = Boolean(refreshToken && verifyRefreshToken(refreshToken).rem);
  } catch {
    // an expired refresh cookie just means a session cookie this time
  }
  const updated = await replacePassword(user._id, password);
  return { user: updated, remember, session: await buildSession(updated) };
}
