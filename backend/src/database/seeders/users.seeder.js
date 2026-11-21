import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';
import { BCRYPT_ROUNDS } from '../../models/user.model.js';
import { countUsers, upsertSeedUser } from '../../repositories/user.repository.js';

const DOMAIN = 'kapekonek.test';
const FIRST = ['Maria', 'Jose', 'Ana', 'Mark', 'Kristine', 'Paolo', 'Joy', 'Ramon', 'Liezl', 'Carlo', 'Mae', 'Noel', 'Grace', 'Dennis', 'Rowena', 'Jun'];
const LAST = ['Reyes', 'Santos', 'Garcia', 'Mendoza', 'Villanueva', 'Bautista', 'Aquino', 'Castillo', 'Manalo', 'Lim', 'Rivera', 'Dela Paz', 'Morales', 'Torres'];

const ACCOUNTS = [
  { email: 'kaluppa', firstName: 'Kaluppa', lastName: 'Admin', username: 'kaluppa', roles: ['kaluppa'], verified: true },
  { email: 'manager', firstName: 'Liza', lastName: 'Ramos', username: 'lizaramos', roles: ['group_manager'], verified: true },
  { email: 'farmer1', firstName: 'Rodel', lastName: 'Mendoza', username: 'rodelmendoza', roles: ['farmer'], verified: true },
  { email: 'farmer2', firstName: 'Nora', lastName: 'Villareal', username: 'noravillareal', roles: ['farmer'], verified: false },
  { email: 'buyer', firstName: 'Juana', lastName: 'Dela Cruz', username: 'juanadc', roles: ['buyer'], verified: true, contactNumber: '09175550102' },
  { email: 'buyer.unverified', firstName: 'Pedro', lastName: 'Lopez', username: 'pedrolopez', roles: ['buyer'], verified: false },
];

/** Fixed seed, so every run produces the same 20 extra buyers and upserts stay idempotent. */
function extraBuyers(count = 20) {
  faker.seed(2026);
  return Array.from({ length: count }, (_, i) => {
    const firstName = faker.helpers.arrayElement(FIRST);
    const lastName = faker.helpers.arrayElement(LAST);
    const n = String(i + 1).padStart(2, '0');
    return {
      email: `buyer${n}`,
      firstName,
      lastName,
      username: `${firstName}${lastName}`.toLowerCase().replace(/[^a-z]/g, '').slice(0, 26) + n,
      roles: ['buyer'],
      verified: true,
      contactNumber: `0917${faker.string.numeric(7)}`,
    };
  });
}

/** Upsert the demo accounts by email. All share SEED_DEFAULT_PASSWORD. */
export async function seedUsers() {
  const password = await bcrypt.hash(env.SEED_DEFAULT_PASSWORD, BCRYPT_ROUNDS);
  const now = new Date();
  for (const { email, verified, ...user } of [...ACCOUNTS, ...extraBuyers()]) {
    await upsertSeedUser({ ...user, email: `${email}@${DOMAIN}`, password, emailVerifiedAt: verified ? now : null });
  }
  return `${await countUsers()} users`;
}
