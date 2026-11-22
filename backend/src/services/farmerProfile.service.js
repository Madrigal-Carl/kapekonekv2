import { env } from '../config/env.js';
import { EMAIL_JOBS } from '../queues/email.jobs.js';
import { enqueueEmail } from '../queues/email.queue.js';
import { findAssociationById } from '../repositories/association.repository.js';
import * as profiles from '../repositories/farmerProfile.repository.js';
import { findActiveRecipientsByRole, findRecipient } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { record } from './audit.service.js';
import { ensureKaluppaChat } from './chat.service.js';
import { notifyUsers } from './notification.service.js';
import { assertUploadAllowed, isOwnUpload } from './upload.service.js';

export const fullName = (user) => `${user.firstName} ${user.lastName}`;
export const farmerEntity = (user) => ({ type: 'farmer', id: user._id, label: fullName(user) });
export const fieldError = (field, message) => new AppError(400, 'Please check the highlighted fields.', { errors: { [field]: message } });
const associationRef = (a) => (a ? { id: String(a._id), name: a.name, municipality: a.municipality } : null);

/** The farmer's association state, as the farmer (and their Group Manager) sees it. */
export const profileDto = (p) => ({
  status: p.status,
  association: associationRef(p.association),
  rejectionReason: p.rejectionReason ?? null,
  requestedAt: p.requestedAt ?? null,
  approvedAt: p.approvedAt ?? null,
  documents: { validId: p.documents?.validId ?? null, landProof: p.documents?.landProof ?? null },
  transferRequest: p.transferRequest?.association
    ? { association: associationRef(p.transferRequest.association), reason: p.transferRequest.reason ?? '', requestedAt: p.transferRequest.requestedAt }
    : null,
});

/**
 * Every farmer account starts with a profile (status `none`, or approved when a Group Manager adds it) and a chat with Kaluppa.
 * @param {unknown} userId
 * @param {object} [fields] initial profile fields
 */
export async function onboardFarmer(userId, fields = {}) {
  await profiles.ensureProfile(userId, fields);
  await ensureKaluppaChat(userId);
}

async function myProfile(user) {
  let profile = await profiles.findProfileByUser(user._id);
  if (!profile) {
    await onboardFarmer(user._id); // Phase 1 farmers created before profiles existed
    profile = await profiles.findProfileByUser(user._id);
  }
  return profile;
}

export const getMyProfile = async (user) => profileDto(await myProfile(user));

/**
 * Check an uploaded document (owner's folder, type, size) and describe it for storage.
 * @param {{ _id: unknown }} owner whoever uploaded it (the farmer, or the Group Manager adding them)
 */
export async function storedDocument(owner, ref, field) {
  if (!isOwnUpload(owner, 'farmer_document', ref)) throw fieldError(field, 'Upload this file again.');
  const { kind, bytes, name } = await assertUploadAllowed('farmer_document', ref.publicId, field);
  return { url: ref.url, publicId: ref.publicId, name, bytes, kind: kind === 'file' ? 'pdf' : 'image' };
}

export async function activeAssociation(id) {
  const association = await findAssociationById(id);
  if (!association || association.archivedAt) throw fieldError('associationId', 'Choose an active association');
  return association;
}

/** Tell whoever decides for the association: its Group Manager, or every Kaluppa account when it has none. */
async function notifyDeciders(association, farmer, title) {
  const recipients = association.groupManager
    ? [await findRecipient(association.groupManager._id)]
    : await findActiveRecipientsByRole('kaluppa');
  const link = `/dashboard/farmers?view=${farmer._id}`;
  await notifyUsers(recipients.map((r) => r._id), { type: 'farmer_request', title, body: association.name, link, data: { farmerId: String(farmer._id) } });
  for (const r of recipients) {
    await enqueueEmail(EMAIL_JOBS.FARMER_REQUEST, { to: r.email, name: r.firstName, farmerName: fullName(farmer), associationName: association.name, url: `${env.CLIENT_URL}${link}` });
  }
}

/** Ask to join an association with a valid ID and proof of land ownership. */
export async function requestToJoin(user, { associationId, validId, landProof }) {
  const current = await myProfile(user);
  if (current.status === 'pending') throw new AppError(409, 'Your request is waiting for approval.');
  if (current.status === 'approved') throw new AppError(409, 'You’re already in an association. Ask for a transfer instead.');
  const association = await activeAssociation(associationId);
  const documents = { validId: await storedDocument(user, validId, 'validId'), landProof: await storedDocument(user, landProof, 'landProof') };
  const updated = await profiles.updateProfileWhen(user._id, { status: { $in: ['none', 'rejected'] } }, {
    $set: { status: 'pending', association: association._id, documents, requestedAt: new Date(), rejectionReason: null },
    $push: { history: { action: 'request', by: user._id, note: association.name } },
  });
  if (!updated) throw new AppError(409, 'Your request is waiting for approval.');
  await notifyDeciders(association, user, `${fullName(user)} wants to join ${association.name}`);
  await record({ actor: user, area: 'farmers', action: 'request', entity: farmerEntity(user), before: { status: current.status }, after: { status: 'pending', association: association.name }, fields: ['status', 'association'] });
  return profileDto(updated);
}

/** An approved farmer asks to move; they stay in their association until the new Group Manager approves. */
export async function requestTransfer(user, { associationId, reason }) {
  const current = await myProfile(user);
  if (current.status !== 'approved') throw new AppError(409, 'Only approved farmers can ask for a transfer.');
  if (current.transferRequest?.association) throw new AppError(409, 'You already asked for a transfer. Withdraw it first.');
  if (String(current.association?._id) === String(associationId)) throw fieldError('associationId', 'You’re already in this association');
  const target = await activeAssociation(associationId);
  const updated = await profiles.updateProfileWhen(user._id, { status: 'approved', transferRequest: null }, {
    $set: { transferRequest: { association: target._id, reason, requestedAt: new Date() } },
    $push: { history: { action: 'transfer_request', by: user._id, note: target.name } },
  });
  if (!updated) throw new AppError(409, 'You already asked for a transfer. Withdraw it first.');
  await notifyDeciders(target, user, `${fullName(user)} wants to move to ${target.name}`);
  await record({ actor: user, area: 'farmers', action: 'transfer_request', entity: farmerEntity(user), after: { transferTo: target.name }, fields: ['transferTo'] });
  return profileDto(updated);
}

export async function withdrawTransfer(user) {
  const current = await myProfile(user);
  const updated = await profiles.updateProfileWhen(user._id, { transferRequest: { $ne: null } }, {
    $set: { transferRequest: null },
    $push: { history: { action: 'transfer_withdraw', by: user._id } },
  });
  if (!updated) throw new AppError(409, 'You have no transfer request.');
  await record({ actor: user, area: 'farmers', action: 'transfer_withdraw', entity: farmerEntity(user), before: { transferTo: current.transferRequest?.association?.name }, fields: ['transferTo'] });
  return profileDto(updated);
}

/** In-app notification and email to the farmer about a decision. */
export async function tellFarmer(farmerId, { type, job, title, body, emailData }) {
  const farmer = await findRecipient(farmerId);
  const link = '/dashboard/account/association';
  await notifyUsers([farmerId], { type, title, body, link });
  if (job) await enqueueEmail(job, { to: farmer.email, name: farmer.firstName, url: `${env.CLIENT_URL}${link}`, ...emailData });
}
