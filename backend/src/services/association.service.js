import * as repo from '../repositories/association.repository.js';
import { countFarmersByAssociation, findApprovedFarmerIds } from '../repositories/farmerProfile.repository.js';
import { findGroupManagerById } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { containsPattern } from '../utils/escapeRegex.js';
import { record } from './audit.service.js';
import { closeChat, endDirectChatsBetween, endMembership, ensureGroupChat, joinGroup } from './chat.service.js';
import { moveManagedFarms } from './farm.service.js';

const AUDITED = ['name', 'municipality', 'description', 'groupManager'];
const notFound = () => new AppError(404, 'Association not found.');
const fullName = (user) => `${user.firstName} ${user.lastName}`;

/** "Boac Highland Growers" → "boac-highland-growers" */
export const slugify = (name) =>
  name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const toDto = (a, counts) => {
  const { approved, pending } = counts.get(String(a._id)) ?? { approved: 0, pending: 0 };
  return {
    id: String(a._id),
    name: a.name,
    slug: a.slug,
    municipality: a.municipality,
    description: a.description,
    groupManager: a.groupManager ? { id: String(a.groupManager._id), name: fullName(a.groupManager), username: a.groupManager.username } : null,
    groupChat: a.groupChat ? String(a.groupChat) : null,
    farmerCount: approved,
    waitingCount: pending,
    status: a.archivedAt ? 'archived' : 'active',
    archivedAt: a.archivedAt,
    createdAt: a.createdAt,
  };
};
const withCounts = async (list) => {
  const counts = await countFarmersByAssociation(list.map((a) => a._id));
  return list.map((a) => toDto(a, counts));
};
const auditView = (a, manager) => ({ name: a.name, municipality: a.municipality, description: a.description, groupManager: manager ? fullName(manager) : null });

/** @param {{ q?: string, status?: string, municipality?: string, page: number, limit: number }} query */
export async function listAssociations({ q, ...query }) {
  const { items, meta } = await repo.listAssociations({ ...query, q: q ? containsPattern(q) : undefined });
  return { items: await withCounts(items), meta };
}

export async function getAssociation(id) {
  const association = await repo.findAssociationById(id);
  if (!association) throw notFound();
  return (await withCounts([association]))[0];
}

/** Active associations for the farmer's "Join your association" window. */
export const associationOptions = async () =>
  (await repo.listActiveOptions()).map((a) => ({
    id: String(a._id),
    name: a.name,
    municipality: a.municipality,
    groupManager: a.groupManager ? { name: `${a.groupManager.firstName} ${a.groupManager.lastName}` } : null,
  }));

/**
 * Move a Group Manager between associations (either may be null). Its chats follow: the old group chat and its
 * chats with the old farmers turn read-only; it joins the new group chat.
 * @throws {AppError} 409 on `field` when `to` already has a Group Manager (the old assignment is kept)
 */
export async function moveManager(managerId, from, to, field = 'associationId') {
  if (from) await repo.clearManager(from._id);
  if (to && !(await repo.claimManager(to._id, managerId))) {
    if (from) await repo.claimManager(from._id, managerId);
    throw new AppError(409, `${to.name} already has a Group Manager.`, { errors: { [field]: `${to.name} already has a Group Manager` } });
  }
  if (from) {
    await endMembership(managerId, [from.groupChat]);
    await endDirectChatsBetween(managerId, await findApprovedFarmerIds(from._id));
  }
  if (to) await joinGroup(managerId, to._id);
  await moveManagedFarms(managerId, to?._id);
}

/** A Group Manager free to run `associationId` (one association per Group Manager). */
async function assignableManager(managerId, associationId) {
  const manager = await findGroupManagerById(managerId);
  if (!manager || manager.status !== 'active') {
    throw new AppError(400, 'Please check the highlighted fields.', { errors: { groupManagerId: 'Choose an active Group Manager' } });
  }
  const current = await repo.findAssociationByManager(managerId);
  if (current && String(current._id) !== String(associationId)) {
    const message = `${fullName(manager)} already manages ${current.name}`;
    throw new AppError(409, `${message}.`, { errors: { groupManagerId: message } });
  }
  return manager;
}

async function assertNameFree(name, exceptId) {
  if (await repo.findAssociationBySlug(slugify(name), exceptId)) {
    throw new AppError(409, 'An association with this name already exists.', { errors: { name: 'An association with this name already exists' } });
  }
}

/** Create an association with its group chat, and optionally its Group Manager. */
export async function createAssociation(actor, { name, municipality, description, groupManagerId }) {
  await assertNameFree(name);
  const manager = groupManagerId ? await assignableManager(groupManagerId) : null;
  const created = await repo.createAssociation({ name, slug: slugify(name), municipality, description });
  const chat = await ensureGroupChat(created._id);
  const association = await repo.updateAssociationFields(created._id, { groupChat: chat._id });
  if (manager) await moveManager(manager._id, null, association, 'groupManagerId');
  await record({ actor, area: 'associations', action: 'create', entity: { type: 'association', id: created._id, label: name }, after: auditView(association, manager), fields: AUDITED });
  return getAssociation(created._id);
}

/** Edit details; `groupManagerId` (when sent) assigns, replaces or removes the Group Manager. */
export async function updateAssociation(actor, id, { name, municipality, description, groupManagerId }) {
  const before = await repo.findAssociationById(id);
  if (!before) throw notFound();
  if (before.archivedAt) throw new AppError(409, 'Restore this association before editing it.');
  await assertNameFree(name, id);
  let manager = before.groupManager;
  if (groupManagerId !== undefined && String(groupManagerId ?? '') !== String(before.groupManager?._id ?? '')) {
    const next = groupManagerId ? await assignableManager(groupManagerId, id) : null;
    if (before.groupManager) await moveManager(before.groupManager._id, before, null, 'groupManagerId');
    if (next) await moveManager(next._id, null, { ...before, groupManager: null }, 'groupManagerId');
    manager = next;
  }
  const after = await repo.updateAssociationFields(id, { name, slug: slugify(name), municipality, description });
  await record({
    actor, area: 'associations', action: 'update', entity: { type: 'association', id, label: name },
    before: auditView(before, before.groupManager), after: auditView(after, manager), fields: AUDITED,
  });
  return getAssociation(id);
}

/** Archive an association with no farmers (approved or waiting) and no Group Manager; its group chat turns read-only. */
export async function archiveAssociation(actor, id) {
  const association = await getAssociation(id);
  if (association.status === 'archived') return association;
  const farmers = association.farmerCount + association.waitingCount;
  const left = [farmers && `${farmers} farmer${farmers === 1 ? '' : 's'}`, association.groupManager && 'a Group Manager'].filter(Boolean);
  if (left.length) throw new AppError(409, `This association still has ${left.join(' and ')}. Move them first.`);
  await repo.updateAssociationFields(id, { archivedAt: new Date() });
  if (association.groupChat) await closeChat(association.groupChat);
  await record({ actor, area: 'associations', action: 'archive', entity: { type: 'association', id, label: association.name } });
  return getAssociation(id);
}

export async function restoreAssociation(actor, id) {
  const association = await getAssociation(id);
  if (association.status === 'active') return association;
  await repo.updateAssociationFields(id, { archivedAt: null });
  await record({ actor, area: 'associations', action: 'restore', entity: { type: 'association', id, label: association.name } });
  return getAssociation(id);
}
