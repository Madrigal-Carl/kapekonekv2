import { createRequire } from 'node:module';
import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';
import { BCRYPT_ROUNDS } from '../../models/user.model.js';
import { findAssociationBySlug } from '../../repositories/association.repository.js';
import { updateProfileWhen } from '../../repositories/farmerProfile.repository.js';
import { findUsersByUsernames, upsertSeedUser } from '../../repositories/user.repository.js';
import { createAssociation, slugify } from '../../services/association.service.js';
import { record } from '../../services/audit.service.js';
import { ensureKaluppaChat, joinGroup } from '../../services/chat.service.js';
import { farmerEntity, onboardFarmer } from '../../services/farmerProfile.service.js';
import { seedEmail } from './users.seeder.js';

const MEDIA = Object.fromEntries(createRequire(import.meta.url)('./data/media.json').map((m) => [m.key, m.url]));
const DAY = 86_400_000;
const ago = (days) => new Date(Date.now() - days * DAY);

// PHASE-2-SPEC §8: 3 associations, 3 Group Managers (one unassigned).
const ASSOCIATIONS = [
  { key: 'sc', name: 'Santa Cruz Coffee Growers', municipality: 'Santa Cruz', manager: 'manager.santacruz', description: 'Robusta and Liberica growers around Pantayin and Matalaba. Meets every first Monday.' },
  { key: 'boac', name: 'Boac Highland Farmers', municipality: 'Boac', manager: 'manager.boac', description: 'Upland farms above Boac town.' },
  { key: 'gasan', name: 'Gasan Coffee Circle', municipality: 'Gasan', manager: null, description: 'A new group still looking for its Group Manager.' },
];

/**
 * About 14 farmers in every state. `state`: [status, association key, by (approver), days ago] — plus a rejection reason,
 * a transfer target, or `createdBy` (made by Kaluppa or a Group Manager: default password, email not verified yet).
 */
const PEOPLE = [
  { handle: 'manager.boac', firstName: 'Mario', lastName: 'Santos', roles: ['group_manager'], note: 'Group Manager, Boac Highland Farmers' },
  { handle: 'manager.unverified', firstName: 'Celso', lastName: 'Garcia', roles: ['group_manager'], createdBy: 'kaluppa', note: 'Group Manager created by Kaluppa, email not verified' },
  { handle: 'farmer.pending', firstName: 'Joy', lastName: 'Lacsamana', state: ['pending', 'sc', null, 2], note: 'Farmer, waiting for approval' },
  { handle: 'farmer.new', firstName: 'Arnel', lastName: 'Dimaano', note: 'Farmer, no association (sees the window)' },
  { handle: 'farmer.rejected', firstName: 'Ben', lastName: 'Ilagan', state: ['rejected', 'sc', 'manager.santacruz', 20], reason: 'The proof of land ownership is blurry. Please upload a clearer photo of the tax declaration.', note: 'Farmer, request rejected' },
  { handle: 'farmer.transfer', firstName: 'Rosa', lastName: 'Manalo', state: ['approved', 'boac', 'manager.boac', 260], transferTo: 'sc', note: 'Farmer in Boac asking to move to Santa Cruz' },
  { handle: 'nestor.perez', firstName: 'Nestor', lastName: 'Perez', state: ['approved', 'sc', 'manager.santacruz', 170] },
  { handle: 'lorna.ilagan', firstName: 'Lorna', lastName: 'Ilagan', state: ['approved', 'sc', 'manager.santacruz', 125] },
  { handle: 'marlon.sevilla', firstName: 'Marlon', lastName: 'Sevilla', state: ['approved', 'sc', 'manager.santacruz', 110] },
  { handle: 'gina.tolentino', firstName: 'Gina', lastName: 'Tolentino', state: ['approved', 'sc', 'manager.santacruz', 75] },
  { handle: 'mylene.cruz', firstName: 'Mylene', lastName: 'Cruz', state: ['pending', 'sc', null, 3] },
  { handle: 'dario.lopez', firstName: 'Dario', lastName: 'Lopez', state: ['pending', 'sc', null, 4] },
  { handle: 'felix.rey', firstName: 'Felix', lastName: 'Rey', state: ['approved', 'boac', 'manager.boac', 90] },
  { handle: 'celia.ramos', firstName: 'Celia', lastName: 'Ramos', state: ['pending', 'boac', null, 1] },
  { handle: 'tomas.leano', firstName: 'Tomas', lastName: 'Leaño', state: ['pending', 'gasan', null, 6] },
];
// farmer.approved and farmer.unverified come from the users seeder; here they join Santa Cruz.
const EXISTING = [
  { handle: 'farmer.approved', state: ['approved', 'sc', 'manager.santacruz', 40] },
  { handle: 'farmer.unverified', state: ['approved', 'sc', 'manager.santacruz', 5], createdBy: 'manager.santacruz' },
];

/** Seed documents are placeholder photos (the real ones are private uploads). */
const documents = (handle) => ({
  validId: { url: MEDIA['cherries-branch'], publicId: `seed/documents/${handle}/valid-id`, name: 'valid-id.jpg', bytes: 1_840_000, kind: 'image' },
  landProof: { url: MEDIA['seedling-hand'], publicId: `seed/documents/${handle}/land-proof`, name: 'tax-declaration.jpg', bytes: 3_210_000, kind: 'image' },
});

/** Sign-in table rows for the people this seeder adds. */
export const associationAccounts = () => PEOPLE.filter((p) => p.note).map((p) => [seedEmail(p.handle), p.handle, p.note]);

async function seedPeople(byHandle) {
  const password = await bcrypt.hash(env.SEED_DEFAULT_PASSWORD, BCRYPT_ROUNDS);
  for (const [i, p] of PEOPLE.entries()) {
    const roles = p.roles ?? ['farmer'];
    await upsertSeedUser({
      username: p.handle,
      firstName: p.firstName,
      lastName: p.lastName,
      roles,
      email: seedEmail(p.handle),
      contactNumber: `0917555${String(200 + i).padStart(4, '0')}`,
      password,
      // Made by Kaluppa or a Group Manager: verify first (Verify email page, created variant); the rest verified at sign-up.
      ...(p.createdBy ? { createdBy: byHandle[p.createdBy]._id, emailVerifiedAt: null, passwordIsDefault: true } : { emailVerifiedAt: new Date() }),
    });
  }
  const users = Object.fromEntries((await findUsersByUsernames(PEOPLE.map((p) => p.handle))).map((u) => [u.username, u]));
  for (const p of PEOPLE) {
    if (p.roles?.includes('group_manager')) await ensureKaluppaChat(users[p.handle]._id);
    else await onboardFarmer(users[p.handle]._id);
  }
  return users;
}

async function seedAssociations(kaluppa, byHandle) {
  const out = {};
  for (const a of ASSOCIATIONS) {
    const existing = await findAssociationBySlug(slugify(a.name));
    out[a.key] = existing ?? (await createAssociation(kaluppa, { name: a.name, municipality: a.municipality, description: a.description, groupManagerId: a.manager ? byHandle[a.manager]._id : null }));
    out[a.key]._id ??= out[a.key].id;
  }
  return out;
}

/** Move one farmer from `none` into its seeded state, with history and audit entries like the real flow. */
async function seedState(person, user, associations, byHandle) {
  const [status, key, approver, days] = person.state;
  const association = associations[key];
  const by = approver ? byHandle[approver] : null;
  const requestedAt = ago(days + 2);
  const decidedAt = ago(days);
  const set = {
    status,
    association: association._id,
    requestedAt,
    documents: person.createdBy ? { validId: null, landProof: null } : documents(person.handle),
    ...(status === 'approved' && { approvedAt: decidedAt, approvedBy: by._id }),
    ...(status === 'rejected' && { rejectionReason: person.reason }),
    ...(person.transferTo && { transferRequest: { association: associations[person.transferTo]._id, reason: 'My farm is closer to Santa Cruz.', requestedAt: ago(1) } }),
  };
  const history = person.createdBy
    ? [{ action: 'create', by: by._id, at: decidedAt }]
    : [{ action: 'request', by: user._id, at: requestedAt, note: association.name }, ...(by ? [{ action: status === 'approved' ? 'approve' : 'reject', by: by._id, at: decidedAt, ...(person.reason && { note: person.reason }) }] : [])];
  if (person.transferTo) history.push({ action: 'transfer_request', by: user._id, at: ago(1), note: associations[person.transferTo].name });
  // Only from a fresh profile, so a second run changes nothing.
  const updated = await updateProfileWhen(user._id, { status: 'none', association: null }, { $set: set, $push: { history: { $each: history } } });
  if (!updated) return;
  if (status === 'approved') await joinGroup(user._id, association._id);

  const entity = farmerEntity(user);
  if (person.createdBy) {
    await record({ actor: by, area: 'farmers', action: 'create', entity, after: { name: entity.label, username: user.username, association: association.name, status }, fields: ['name', 'username', 'association', 'status'] });
  } else {
    await record({ actor: user, area: 'farmers', action: 'request', entity, before: { status: 'none' }, after: { status: 'pending', association: association.name }, fields: ['status', 'association'] });
    if (by) await record({ actor: by, area: 'farmers', action: status === 'approved' ? 'approve' : 'reject', entity, before: { status: 'pending' }, after: { status, ...(person.reason && { rejectionReason: person.reason }) }, fields: ['status', 'rejectionReason'] });
  }
  if (person.transferTo) await record({ actor: user, area: 'farmers', action: 'transfer_request', entity, after: { transferTo: associations[person.transferTo].name }, fields: ['transferTo'] });
}

/**
 * Phase 2 people (PHASE-2-SPEC §8): associations with group chats and Group Managers, farmers in every state,
 * Kaluppa chats, and audit entries for each seeded step. Idempotent.
 */
export async function seedAssociationsAndFarmers() {
  const base = Object.fromEntries((await findUsersByUsernames(['kaluppa', 'manager.santacruz', ...EXISTING.map((e) => e.handle)])).map((u) => [u.username, u]));
  const people = await seedPeople(base);
  const byHandle = { ...base, ...people };
  const associations = await seedAssociations(byHandle.kaluppa, byHandle);
  for (const person of [...EXISTING, ...PEOPLE].filter((p) => p.state)) await seedState(person, byHandle[person.handle], associations, byHandle);
  return `${ASSOCIATIONS.length} associations, ${PEOPLE.length} people`;
}
