import { env } from '../config/env.js';
import { EMAIL_JOBS } from '../queues/email.jobs.js';
import { enqueueEmail } from '../queues/email.queue.js';
import { BEAN_CAP_KG } from '../constants/beans.js';
import { findAssociationById } from '../repositories/association.repository.js';
import { capUsedKg, soldKgSince } from '../repositories/bean.repository.js';
import { countFarmsByAssociation, findFarmIdsInScope, ownerTotals } from '../repositories/farm.repository.js';
import { yieldByVariety } from '../repositories/harvest.repository.js';
import * as profiles from '../repositories/farmerProfile.repository.js';
import { findActiveRecipientsByRole, findNamesByIds, findRecipient } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { record } from './audit.service.js';
import { endDirectChatsBetween, ensureDirectChat, ensureKaluppaChat } from './chat.service.js';
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

/**
 * The farmer's own view (FarmerAssociation.dc.html): who runs the association and its size, who approved them,
 * the request history with names, the bean cap and their own record totals for the stats strip.
 */
export async function getMyProfile(user) {
  const profile = await myProfile(user);
  const dto = profileDto(profile);
  const association = profile.association;
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const history = profile.history ?? [];
  const people = [...new Set([...history.map((h) => h.by), profile.approvedBy].filter(Boolean).map(String))];
  const [manager, names, counts, farms, totals, usedKg, soldKg, harvests] = await Promise.all([
    association?.groupManager ? findRecipient(association.groupManager) : null,
    findNamesByIds(people),
    association ? profiles.countFarmersByAssociation([association._id]) : null,
    association ? countFarmsByAssociation(association._id) : 0,
    ownerTotals(user._id),
    capUsedKg(user._id),
    soldKgSince(user._id, yearStart),
    findFarmIdsInScope({ ownerId: user._id }).then((ids) => (ids.length ? yieldByVariety(ids, yearStart) : [])),
  ]);
  const nameOf = new Map(names.map((u) => [String(u._id), fullName(u)]));
  if (association) {
    dto.association.groupManager = manager ? { id: String(manager._id), name: fullName(manager), contactNumber: manager.contactNumber ?? null, email: manager.email ?? null } : null;
    dto.association.farmers = counts.get(String(association._id)).approved;
    dto.association.farms = farms;
  }
  dto.approvedBy = profile.approvedBy ? { name: nameOf.get(String(profile.approvedBy)) ?? null } : null;
  dto.history = history.map((h) => ({ action: h.action, at: h.at, by: nameOf.get(String(h.by)) ?? null, note: h.note ?? null }));
  dto.cap = { capKg: BEAN_CAP_KG, usedKg, leftKg: Math.max(0, BEAN_CAP_KG - usedKg) };
  dto.records = { ...totals, harvestKgThisYear: harvests.reduce((sum, row) => sum + row.kg, 0), soldKgThisYear: soldKg };
  return dto;
}

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
  // A resend after a rejection may keep the documents already on file.
  const keep = (ref, field, label) => {
    if (ref) return storedDocument(user, ref, field);
    if (current.documents?.[field]) return current.documents[field];
    throw fieldError(field, `Upload your ${label}`);
  };
  const documents = { validId: await keep(validId, 'validId', 'valid ID'), landProof: await keep(landProof, 'landProof', 'proof of land ownership') };
  const updated = await profiles.updateProfileWhen(user._id, { status: { $in: ['none', 'rejected'] } }, {
    $set: { status: 'pending', association: association._id, documents, requestedAt: new Date(), rejectionReason: null },
    $push: { history: { action: 'request', by: user._id, note: association.name } },
  });
  if (!updated) throw new AppError(409, 'Your request is waiting for approval.');
  // The farmer can message the Group Manager while they wait; the group chat comes with approval (Change 08).
  if (association.groupManager) await ensureDirectChat(user._id, association.groupManager._id);
  await notifyDeciders(association, user, `${fullName(user)} wants to join ${association.name}`);
  await record({ actor: user, area: 'farmers', action: 'request', entity: farmerEntity(user), before: { status: current.status }, after: { status: 'pending', association: association.name }, fields: ['status', 'association'] });
  return getMyProfile(user);
}

/** The farmer takes back a waiting request; they're back to no association (PHASE-2-SPEC §3.1). */
export async function withdrawRequest(user) {
  const current = await myProfile(user);
  const updated = await profiles.updateProfileWhen(user._id, { status: 'pending' }, {
    $set: { status: 'none', association: null, requestedAt: null },
    $push: { history: { action: 'request_withdraw', by: user._id, note: current.association?.name } },
  });
  if (!updated) throw new AppError(409, 'You have no request waiting.');
  if (current.association?.groupManager) await endDirectChatsBetween(user._id, [current.association.groupManager]);
  await record({ actor: user, area: 'farmers', action: 'request_withdraw', entity: farmerEntity(user), before: { status: 'pending', association: current.association?.name }, after: { status: 'none' }, fields: ['status', 'association'] });
  return getMyProfile(user);
}

/** Replace documents on file. Approval doesn't change, and a waiting request keeps waiting. */
export async function replaceDocuments(user, refs) {
  const current = await myProfile(user);
  if (current.status === 'none') throw new AppError(409, 'Send a request to join an association first.');
  const fields = ['validId', 'landProof'].filter((field) => refs[field]);
  const set = {};
  for (const field of fields) set[`documents.${field}`] = await storedDocument(user, refs[field], field);
  await profiles.updateProfileWhen(user._id, {}, { $set: set, $push: { history: { action: 'documents', by: user._id, note: fields.join(',') } } });
  // Which documents only: the audit log never stores the files.
  await record({ actor: user, area: 'farmers', action: 'documents', entity: farmerEntity(user), after: { replaced: fields.join(', ') }, fields: ['replaced'] });
  return getMyProfile(user);
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
  return getMyProfile(user);
}

export async function withdrawTransfer(user) {
  const current = await myProfile(user);
  const updated = await profiles.updateProfileWhen(user._id, { transferRequest: { $ne: null } }, {
    $set: { transferRequest: null },
    $push: { history: { action: 'transfer_withdraw', by: user._id } },
  });
  if (!updated) throw new AppError(409, 'You have no transfer request.');
  await record({ actor: user, area: 'farmers', action: 'transfer_withdraw', entity: farmerEntity(user), before: { transferTo: current.transferRequest?.association?.name }, fields: ['transferTo'] });
  return getMyProfile(user);
}

/** In-app notification and email to the farmer about a decision. */
export async function tellFarmer(farmerId, { type, job, title, body, emailData }) {
  const farmer = await findRecipient(farmerId);
  const link = '/dashboard/account/association';
  await notifyUsers([farmerId], { type, title, body, link });
  if (job) await enqueueEmail(job, { to: farmer.email, name: farmer.firstName, url: `${env.CLIENT_URL}${link}`, ...emailData });
}
