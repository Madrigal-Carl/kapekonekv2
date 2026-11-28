import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';
import { BCRYPT_ROUNDS } from '../../models/user.model.js';
import { countUsers, findUsersByUsernames, upsertSeedUser } from '../../repositories/user.repository.js';
import { ensureKaluppaChat } from '../../services/chat.service.js';
import { onboardFarmer } from '../../services/farmerProfile.service.js';

const FIRST = ['Maria', 'Jose', 'Ana', 'Mark', 'Kristine', 'Paolo', 'Joy', 'Ramon', 'Liezl', 'Carlo', 'Mae', 'Noel', 'Grace', 'Dennis', 'Rowena', 'Jun'];
const LAST = ['Reyes', 'Santos', 'Garcia', 'Mendoza', 'Villanueva', 'Bautista', 'Aquino', 'Castillo', 'Manalo', 'Lim', 'Rivera', 'Dela Paz', 'Morales', 'Torres'];

/** `handle` is both the username and the email's tag (PRODUCT-SPEC §11). */
const ACCOUNTS = [
  { handle: 'kaluppa', firstName: 'Kaluppa', lastName: 'Admin', roles: ['kaluppa'], verified: true },
  { handle: 'manager.santacruz', firstName: 'Liza', lastName: 'Ramos', roles: ['group_manager'], verified: true },
  { handle: 'manager.unassigned', firstName: 'Ramon', lastName: 'Aguilar', roles: ['group_manager'], verified: true },
  { handle: 'farmer.approved', firstName: 'Rodel', lastName: 'Mendoza', roles: ['farmer'], verified: true },
  // Made by a Group Manager (Change 08): default password, email not verified yet; joins Santa Cruz in the associations seeder.
  { handle: 'farmer.unverified', firstName: 'Nora', lastName: 'Villareal', roles: ['farmer'], verified: false, createdBy: 'manager.santacruz', passwordIsDefault: true },
  { handle: 'buyer', firstName: 'Juana', lastName: 'Dela Cruz', roles: ['buyer'], verified: true, contactNumber: '09175550102' },
  { handle: 'buyer.unverified', firstName: 'Pedro', lastName: 'Lopez', roles: ['buyer'], verified: false },
];

/**
 * A seed account's Gmail address: `you+<handle>@gmail.com` when SEED_EMAIL_BASE is set, else `kapekonek.<handle>@gmail.com`.
 * @param {string} handle
 * @param {string} [base] defaults to SEED_EMAIL_BASE
 */
export function seedEmail(handle, base = env.SEED_EMAIL_BASE) {
  if (!base) return `kapekonek.${handle}@gmail.com`;
  const [local, domain] = base.toLowerCase().split('@');
  return `${local}+${handle}@${domain}`;
}

/** Fixed seed, so every run produces the same 20 extra buyers and upserts stay idempotent. */
function extraBuyers(count = 20) {
  faker.seed(2026);
  return Array.from({ length: count }, (_, i) => ({
    handle: `buyer${String(i + 1).padStart(2, '0')}`,
    firstName: faker.helpers.arrayElement(FIRST),
    lastName: faker.helpers.arrayElement(LAST),
    roles: ['buyer'],
    verified: true,
    contactNumber: `0917${faker.string.numeric(7)}`,
  }));
}

/** Upsert the demo accounts by username (= handle). All share SEED_DEFAULT_PASSWORD and are flagged `isSeed`. */
export async function seedUsers() {
  const password = await bcrypt.hash(env.SEED_DEFAULT_PASSWORD, BCRYPT_ROUNDS);
  const now = new Date();
  for (const { handle, verified, createdBy, ...user } of [...ACCOUNTS, ...extraBuyers()]) {
    const creator = createdBy && (await findUsersByUsernames([createdBy]))[0];
    await upsertSeedUser({ ...user, username: handle, email: seedEmail(handle), password, emailVerifiedAt: verified ? now : null, ...(creator && { createdBy: creator._id }) });
  }
  // Like real sign-ups: farmers get a profile, farmers and Group Managers a chat with Kaluppa.
  for (const account of await findUsersByUsernames(ACCOUNTS.map((a) => a.handle))) {
    if (account.roles.includes('farmer')) await onboardFarmer(account._id);
    else if (account.roles.includes('group_manager')) await ensureKaluppaChat(account._id);
  }
  return `${await countUsers()} users`;
}

/** What each account is for, in the sign-in table. */
const NOTES = {
  'kaluppa': 'Kaluppa (admin)',
  'manager.santacruz': 'Group Manager, Santa Cruz Coffee Growers (4 waiting)',
  'manager.unassigned': 'Group Manager, no association',
  'farmer.approved': 'Approved farmer, Santa Cruz',
  'farmer.unverified': 'Farmer created by a Group Manager, email not verified',
  'buyer': 'Buyer with addresses and orders',
  'buyer.unverified': 'Buyer, blocked until verified',
};

/**
 * The sign-in table printed after seeding.
 * @param {string[][]} [more] rows from later seeders: [email, username, account]
 */
export function signInTable(more = []) {
  const rows = [
    ['Email', 'Username', 'Account'],
    ...ACCOUNTS.map((a) => [seedEmail(a.handle), a.handle, NOTES[a.handle]]),
    ...more,
    [`${seedEmail('buyer01')} … buyer20`, 'buyer01 … buyer20', 'Buyers (reviewers)'],
  ];
  const width = (i) => Math.max(...rows.map((r) => r[i].length));
  const line = (r) => `  ${r[0].padEnd(width(0))}  ${r[1].padEnd(width(1))}  ${r[2]}`;
  return [
    `Sign in with the email or the username. Password: ${env.SEED_DEFAULT_PASSWORD}`,
    ...rows.map(line),
    env.SEED_EMAIL_BASE ? '' : 'SEED_EMAIL_BASE is empty: emails to these accounts are written to storage/mail/, never sent.',
  ].filter(Boolean).join('\n');
}
