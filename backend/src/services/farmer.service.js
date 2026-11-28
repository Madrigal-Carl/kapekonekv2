import { EMAIL_JOBS } from '../queues/email.jobs.js';
import { DEFAULT_PASSWORD } from '../constants/accounts.js';
import { BEAN_CAP_KG } from '../constants/beans.js';
import { capUsedKgByFarmers } from '../repositories/bean.repository.js';
import { ownedFarmsByOwners } from '../repositories/farm.repository.js';
import * as profiles from '../repositories/farmerProfile.repository.js';
import {
  createUser,
  findIdentityConflicts,
  findUserById,
  listUsersAmong,
  resetToDefaultPassword,
  updateProfileFields,
} from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { containsPattern } from '../utils/escapeRegex.js';
import { record } from './audit.service.js';
import { sendAccountCreated, sendPasswordWasReset } from './auth.service.js';
import { endDirectChatsBetween, endMembership, joinGroup } from './chat.service.js';
import { moveOwnerRecords } from './farm.service.js';
import {
  activeAssociation,
  farmerEntity,
  fieldError,
  fullName,
  onboardFarmer,
  profileDto,
  storedDocument,
  tellFarmer,
} from './farmerProfile.service.js';
import { isAssociationManager, seesEveryAssociation } from './policy.service.js';

const notFound = () => new AppError(404, 'Farmer not found.');
const decided = () => new AppError(409, 'This request was already decided.');
const PROFILE_AUDIT = ['name', 'username', 'email', 'contactNumber'];

const farmerDto = (user, profile, { withDocuments = false } = {}) => {
  const { documents, ...state } = profileDto(profile);
  return {
    id: String(user._id),
    firstName: user.firstName,
    middleName: user.middleName ?? null,
    lastName: user.lastName,
    name: fullName(user),
    initials: `${user.firstName[0]}${user.lastName[0]}`.toUpperCase(),
    avatar: user.avatar?.url ? { url: user.avatar.url } : null,
    username: user.username,
    email: user.email ?? null,
    contactNumber: user.contactNumber ?? null,
    addedByGroupManager: Boolean(user.createdBy),
    ...state,
    ...(withDocuments && { documents }),
    since: profile.approvedAt ?? user.createdAt,
    createdAt: user.createdAt,
  };
};
const auditView = (user) => ({ name: fullName(user), username: user.username, email: user.email ?? null, contactNumber: user.contactNumber ?? null });

/** The association a Group Manager acts for; null for Kaluppa (every association). */
const scopeOf = (actor) => (seesEveryAssociation(actor) ? null : actor.associationId ?? false);
const manages = (actor, association) => seesEveryAssociation(actor) || isAssociationManager(actor, association?._id);

/** A farmer the actor may see: in its association, or asking to transfer into it. 404 otherwise (no leak). */
async function loadFarmer(actor, id) {
  const user = await findUserById(id);
  const profile = user?.roles.includes('farmer') && (await profiles.findProfileByUser(id));
  if (!profile || !(manages(actor, profile.association) || manages(actor, profile.transferRequest?.association))) throw notFound();
  return { user, profile };
}

/** @param {{ q?: string, status?: string, page: number, limit: number }} query */
export async function listFarmers(actor, { q, status, associationId: chosen, page, limit }) {
  const associationId = scopeOf(actor) ?? chosen ?? null;
  if (associationId === false) return { items: [], meta: { page, limit, total: 0 } };
  const ids = await profiles.findFarmerIdsInScope({ associationId, status });
  const { items, meta } = await listUsersAmong({ ids, words: q ? q.split(/\s+/).map(containsPattern) : [], page, limit });
  const userIds = items.map((u) => u._id);
  const [found, used, owned] = await Promise.all([profiles.findProfilesByUsers(userIds), capUsedKgByFarmers(userIds), ownedFarmsByOwners(userIds)]);
  const byUser = new Map(found.map((p) => [String(p.user), p]));
  // Unapproved farmers carry what's left of the 5 kg cap, so a Group Manager's picker can show who is at the limit.
  const capLeftKg = (id, profile) => (profile?.status === 'approved' ? null : Math.max(0, BEAN_CAP_KG - (used.get(String(id)) ?? 0)));
  return {
    items: items.map((u) => ({
      ...farmerDto(u, byUser.get(String(u._id))),
      capLeftKg: capLeftKg(u._id, byUser.get(String(u._id))),
      farms: owned.get(String(u._id)) ?? { count: 0, first: null },
    })),
    meta,
  };
}

export async function getFarmer(actor, id) {
  const { user, profile } = await loadFarmer(actor, id);
  return farmerDto(user, profile, { withDocuments: true });
}

async function assertIdentityFree({ email, username }, exceptId) {
  const taken = await findIdentityConflicts({ email, username }, exceptId);
  if (taken.email || taken.username) {
    throw new AppError(409, 'Some details are already in use.', {
      code: taken.username ? 'USERNAME_TAKEN' : 'CONFLICT',
      errors: { ...(taken.email && { email: 'Email is already taken' }), ...(taken.username && { username: 'Username is already taken' }) },
    });
  }
}

async function documentsFrom(actor, { validId, landProof }) {
  return {
    ...(validId && { 'documents.validId': await storedDocument(actor, validId, 'validId') }),
    ...(landProof && { 'documents.landProof': await storedDocument(actor, landProof, 'landProof') }),
  };
}

/**
 * A Group Manager adds an approved farmer to its association (Change 08): the email is required, the password is the
 * default `KapeKonek@123`, and the farmer verifies the email before the dashboard opens.
 */
export async function createFarmer(actor, { associationId: chosen, validId, landProof, email, ...fields }) {
  const associationId = scopeOf(actor) ?? chosen;
  if (!associationId) {
    if (scopeOf(actor) === false) throw new AppError(409, 'You need an association before you can add farmers.');
    throw fieldError('associationId', 'Choose an association');
  }
  const association = await activeAssociation(associationId);
  await assertIdentityFree({ email, username: fields.username });
  const docs = await documentsFrom(actor, { validId, landProof });
  const user = await createUser({
    ...fields,
    email,
    roles: ['farmer'],
    password: DEFAULT_PASSWORD,
    passwordIsDefault: true,
    emailVerifiedAt: null,
    createdBy: actor._id,
  });
  const now = new Date();
  await onboardFarmer(user._id, {
    status: 'approved', association: association._id, approvedAt: now, approvedBy: actor._id,
    documents: { validId: docs['documents.validId'] ?? null, landProof: docs['documents.landProof'] ?? null },
    history: [{ action: 'create', by: actor._id, at: now }],
  });
  await joinGroup(user._id, association._id);
  await sendAccountCreated(user, fullName(actor));
  await record({
    actor, area: 'farmers', action: 'create', entity: farmerEntity(user),
    after: { ...auditView(user), association: association.name, status: 'approved' }, fields: [...PROFILE_AUDIT, 'association', 'status'],
  });
  return getFarmer(actor, user._id);
}

/** Edit a farmer of the association. A new email must be verified again. */
export async function updateFarmer(actor, id, { validId, landProof, email, ...fields }) {
  const { user: before, profile } = await loadFarmer(actor, id);
  if (!manages(actor, profile.association)) throw notFound(); // a transfer into the association isn't theirs to edit yet
  const nextEmail = email ?? before.email ?? null; // an email can be added or changed, never removed
  await assertIdentityFree({ email: nextEmail, username: fields.username }, id);
  const docs = await documentsFrom(actor, { validId, landProof });
  if (Object.keys(docs).length) await profiles.updateProfileWhen(id, {}, { $set: docs });
  const emailChanged = Boolean(nextEmail) && nextEmail !== before.email;
  const after = await updateProfileFields(id, { ...fields, ...(nextEmail && { email: nextEmail }), ...(emailChanged && { emailVerifiedAt: null }) });
  if (emailChanged) await sendAccountCreated(after, fullName(actor));
  await record({ actor, area: 'farmers', action: 'update', entity: farmerEntity(after), before: auditView(before), after: auditView(after), fields: PROFILE_AUDIT });
  return getFarmer(actor, id);
}

/**
 * Reset password (Change 08): back to `KapeKonek@123`, every session ends, and the farmer gets an email. Only the
 * Group Manager of the farmer's association (`farmers.reset_password`). The password itself is never audited.
 */
export async function resetFarmerPassword(actor, id) {
  const { user, profile } = await loadFarmer(actor, id);
  if (!isAssociationManager(actor, profile.association?._id)) throw notFound(); // their own Group Manager only (not Kaluppa)
  await resetToDefaultPassword(id, DEFAULT_PASSWORD);
  await sendPasswordWasReset(user, fullName(actor));
  await record({ actor, area: 'farmers', action: 'reset_password', entity: farmerEntity(user) });
}

export async function approveFarmer(actor, id) {
  const { user, profile } = await loadFarmer(actor, id);
  if (!manages(actor, profile.association)) throw notFound();
  if (profile.status !== 'pending') throw decided();
  const association = profile.association;
  const updated = await profiles.updateProfileWhen(id, { status: 'pending', association: association._id }, {
    $set: { status: 'approved', approvedAt: new Date(), approvedBy: actor._id, rejectionReason: null },
    $push: { history: { action: 'approve', by: actor._id } },
  });
  if (!updated) throw decided();
  await joinGroup(id, association._id);
  await moveOwnerRecords(id, association._id);
  await tellFarmer(id, {
    type: 'farmer_decision', job: EMAIL_JOBS.FARMER_DECISION, title: `You're now an approved farmer of ${association.name}`,
    emailData: { approved: true, associationName: association.name },
  });
  await record({ actor, area: 'farmers', action: 'approve', entity: farmerEntity(user), before: { status: 'pending' }, after: { status: 'approved' }, fields: ['status'] });
  return farmerDto(user, updated);
}

export async function rejectFarmer(actor, id, { reason }) {
  const { user, profile } = await loadFarmer(actor, id);
  if (!manages(actor, profile.association)) throw notFound();
  if (profile.status !== 'pending') throw decided();
  const updated = await profiles.updateProfileWhen(id, { status: 'pending', association: profile.association._id }, {
    $set: { status: 'rejected', rejectionReason: reason },
    $push: { history: { action: 'reject', by: actor._id, note: reason } },
  });
  if (!updated) throw decided();
  await tellFarmer(id, {
    type: 'farmer_decision', job: EMAIL_JOBS.FARMER_DECISION, title: `Your request to join ${profile.association.name} wasn't approved`, body: reason,
    emailData: { approved: false, associationName: profile.association.name, reason },
  });
  await record({ actor, area: 'farmers', action: 'reject', entity: farmerEntity(user), before: { status: 'pending' }, after: { status: 'rejected', rejectionReason: reason }, fields: ['status', 'rejectionReason'] });
  return farmerDto(user, updated);
}

/** The new association's Group Manager approves a transfer; approval carries over and the chats follow. */
export async function approveTransfer(actor, id) {
  const { user, profile } = await loadFarmer(actor, id);
  const target = profile.transferRequest?.association;
  if (!target || !manages(actor, target)) throw notFound();
  const old = profile.association;
  const updated = await profiles.updateProfileWhen(id, { status: 'approved', 'transferRequest.association': target._id }, {
    $set: { association: target._id, transferRequest: null },
    $push: { history: { action: 'transfer_approve', by: actor._id, note: target.name } },
  });
  if (!updated) throw decided();
  if (old) {
    await endMembership(id, [old.groupChat]);
    const oldMembers = (await profiles.findApprovedFarmerIds(old._id)).filter((f) => String(f) !== String(id));
    await endDirectChatsBetween(id, [...oldMembers, ...(old.groupManager ? [old.groupManager] : [])]);
  }
  await joinGroup(id, target._id);
  await moveOwnerRecords(id, target._id);
  await tellFarmer(id, {
    type: 'transfer_decision', job: EMAIL_JOBS.TRANSFER_DECISION, title: `You moved to ${target.name}`,
    emailData: { approved: true, associationName: target.name },
  });
  await record({ actor, area: 'farmers', action: 'transfer_approve', entity: farmerEntity(user), before: { association: old?.name ?? null }, after: { association: target.name }, fields: ['association'] });
  return farmerDto(user, updated);
}

export async function rejectTransfer(actor, id, { reason }) {
  const { user, profile } = await loadFarmer(actor, id);
  const target = profile.transferRequest?.association;
  if (!target || !manages(actor, target)) throw notFound();
  const updated = await profiles.updateProfileWhen(id, { 'transferRequest.association': target._id }, {
    $set: { transferRequest: null },
    $push: { history: { action: 'transfer_reject', by: actor._id, note: reason } },
  });
  if (!updated) throw decided();
  await tellFarmer(id, {
    type: 'transfer_decision', job: EMAIL_JOBS.TRANSFER_DECISION, title: `Your transfer to ${target.name} wasn't approved`, body: reason,
    emailData: { approved: false, associationName: target.name, reason },
  });
  await record({ actor, area: 'farmers', action: 'transfer_reject', entity: farmerEntity(user), before: { transferTo: target.name }, after: { reason }, fields: ['transferTo', 'reason'] });
  return farmerDto(user, updated);
}

/** Remove an approved farmer: unaffiliated and unapproved again; chats with the group and its Group Manager turn read-only. */
export async function removeFarmer(actor, id, { reason }) {
  const { user, profile } = await loadFarmer(actor, id);
  const association = profile.association;
  if (!manages(actor, association)) throw notFound();
  const updated = await profiles.updateProfileWhen(id, { status: 'approved', association: association._id }, {
    $set: { status: 'none', association: null, approvedAt: null, approvedBy: null, transferRequest: null },
    $push: { history: { action: 'remove', by: actor._id, note: reason } },
  });
  if (!updated) throw new AppError(409, 'This farmer isn’t an approved member of the association anymore.');
  await endMembership(id, [association.groupChat]);
  await moveOwnerRecords(id, null);
  if (association.groupManager) await endDirectChatsBetween(id, [association.groupManager]);
  await tellFarmer(id, { type: 'farmer_decision', title: `You were removed from ${association.name}`, body: reason });
  await record({
    actor, area: 'farmers', action: 'remove', entity: farmerEntity(user),
    before: { status: 'approved', association: association.name }, after: { status: 'none', association: null, reason }, fields: ['status', 'association', 'reason'],
  });
  return farmerDto(user, updated);
}
