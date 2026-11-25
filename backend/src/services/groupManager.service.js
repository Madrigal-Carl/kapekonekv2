import { randomBytes } from 'node:crypto';
import {
  findAssignedManagerIds,
  findAssociationById,
  findAssociationByManager,
  findAssociationsByManagers,
  findManagerIdsByAssociationName,
} from '../repositories/association.repository.js';
import { countFarmersByAssociation } from '../repositories/farmerProfile.repository.js';
import {
  createUser,
  findGroupManagerById,
  findIdentityConflicts,
  listGroupManagers as listGroupManagerPage,
  setAccountStatus,
  updateProfileFields,
} from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { containsPattern } from '../utils/escapeRegex.js';
import { moveManager } from './association.service.js';
import { record } from './audit.service.js';
import { sendAccountInvite } from './auth.service.js';
import { ensureKaluppaChat } from './chat.service.js';

const AUDITED = ['name', 'username', 'email', 'contactNumber', 'association', 'status'];
const notFound = () => new AppError(404, 'Group Manager not found.');
const fullName = (u) => `${u.firstName} ${u.lastName}`;
const status = (user, association) => (user.status === 'suspended' ? 'archived' : association ? 'active' : 'unassigned');

const toDto = (user, association, counts) => ({
  id: String(user._id),
  firstName: user.firstName,
  middleName: user.middleName ?? null,
  lastName: user.lastName,
  name: fullName(user),
  initials: `${user.firstName[0]}${user.lastName[0]}`.toUpperCase(),
  avatar: user.avatar?.url ? { url: user.avatar.url } : null,
  username: user.username,
  email: user.email,
  contactNumber: user.contactNumber ?? null,
  association: association
    ? { id: String(association._id), name: association.name, farmerCount: counts.get(String(association._id))?.approved ?? 0, waitingCount: counts.get(String(association._id))?.pending ?? 0 }
    : null,
  status: status(user, association),
  lastSignInAt: user.lastLoginAt ?? null,
  createdAt: user.createdAt,
});
const auditView = (user, association) => ({
  name: fullName(user), username: user.username, email: user.email, contactNumber: user.contactNumber ?? null,
  association: association?.name ?? null, status: status(user, association),
});

/** @param {{ q?: string, status?: string, page: number, limit: number }} query */
export async function listGroupManagers({ q, status: wanted, page, limit }) {
  const { items, meta } = await listGroupManagerPage({
    words: q ? q.split(/\s+/).map(containsPattern) : [],
    orIds: q ? await findManagerIdsByAssociationName(containsPattern(q)) : [],
    status: wanted,
    assignedIds: wanted === 'active' || wanted === 'unassigned' ? await findAssignedManagerIds() : [],
    page,
    limit,
  });
  const associations = await findAssociationsByManagers(items.map((u) => u._id));
  const counts = await countFarmersByAssociation(associations.map((a) => a._id));
  const byManager = new Map(associations.map((a) => [String(a.groupManager), a]));
  return { items: items.map((u) => toDto(u, byManager.get(String(u._id)), counts)), meta };
}

export async function getGroupManager(id) {
  const user = await findGroupManagerById(id);
  if (!user) throw notFound();
  const association = await findAssociationByManager(id);
  return toDto(user, association, await countFarmersByAssociation(association ? [association._id] : []));
}

async function assertIdentityFree(fields, exceptId) {
  const taken = await findIdentityConflicts(fields, exceptId);
  if (taken.email || taken.username) {
    throw new AppError(409, 'Some details are already in use.', {
      code: taken.username ? 'USERNAME_TAKEN' : 'CONFLICT',
      errors: { ...(taken.email && { email: 'Email is already taken' }), ...(taken.username && { username: 'Username is already taken' }) },
    });
  }
}

/** An active association with no other Group Manager. */
async function assignableAssociation(associationId, managerId = null) {
  const association = await findAssociationById(associationId);
  if (!association || association.archivedAt) {
    throw new AppError(400, 'Please check the highlighted fields.', { errors: { associationId: 'Choose an active association' } });
  }
  if (association.groupManager && String(association.groupManager._id) !== String(managerId)) {
    throw new AppError(409, `${association.name} already has a Group Manager.`, { errors: { associationId: `${association.name} already has a Group Manager` } });
  }
  return association;
}

/** Kaluppa creates a Group Manager; an invite email lets them set their password. */
export async function createGroupManager(actor, { associationId, ...fields }) {
  await assertIdentityFree(fields);
  const association = associationId ? await assignableAssociation(associationId) : null;
  const user = await createUser({
    ...fields,
    roles: ['group_manager'],
    password: `${randomBytes(24).toString('base64url')}!1a`, // unusable until the invite sets one
    createdBy: actor._id,
  });
  await ensureKaluppaChat(user._id);
  if (association) await moveManager(user._id, null, association);
  await sendAccountInvite(user);
  await record({ actor, area: 'group_managers', action: 'create', entity: { type: 'user', id: user._id, label: fullName(user) }, after: auditView(user, association), fields: AUDITED });
  return getGroupManager(user._id);
}

/** Edit details; a different `associationId` moves them (null = unassign). */
export async function updateGroupManager(actor, id, { associationId, ...fields }) {
  const before = await findGroupManagerById(id);
  if (!before) throw notFound();
  if (before.status === 'suspended') throw new AppError(409, 'Restore this Group Manager before editing them.');
  await assertIdentityFree(fields, id);
  const current = await findAssociationByManager(id);
  let next = current;
  if (String(associationId ?? '') !== String(current?._id ?? '')) {
    next = associationId ? await assignableAssociation(associationId, id) : null;
    await moveManager(id, current, next);
  }
  const after = await updateProfileFields(id, { ...fields, ...(fields.email !== before.email && { emailVerifiedAt: null }) });
  await record({
    actor, area: 'group_managers', action: 'update', entity: { type: 'user', id, label: fullName(after) },
    before: auditView(before, current), after: auditView(after, next), fields: AUDITED,
  });
  return getGroupManager(id);
}

/** Archive: they can't sign in, open sessions end, and the association goes back to Kaluppa. */
export async function archiveGroupManager(actor, id) {
  const before = await findGroupManagerById(id);
  if (!before) throw notFound();
  if (before.status === 'suspended') return getGroupManager(id);
  const current = await findAssociationByManager(id);
  if (current) await moveManager(id, current, null);
  const after = await setAccountStatus(id, 'suspended');
  await record({ actor, area: 'group_managers', action: 'archive', entity: { type: 'user', id, label: fullName(before) }, before: auditView(before, current), after: auditView(after, null), fields: AUDITED });
  return getGroupManager(id);
}

export async function restoreGroupManager(actor, id) {
  const before = await findGroupManagerById(id);
  if (!before) throw notFound();
  if (before.status === 'active') return getGroupManager(id);
  const after = await setAccountStatus(id, 'active');
  await record({ actor, area: 'group_managers', action: 'restore', entity: { type: 'user', id, label: fullName(before) }, before: auditView(before, null), after: auditView(after, null), fields: AUDITED });
  return getGroupManager(id);
}
