import { seedAddresses } from './addresses.seeder.js';
import { seedCategories } from './categories.seeder.js';
import { seedDemo } from './demo.seeder.js';
import { seedPosts } from './posts.seeder.js';
import { seedProducts } from './products.seeder.js';
import { seedRoles } from './roles.seeder.js';
import { seedSettings } from './settings.seeder.js';
import { seedUsers, signInTable } from './users.seeder.js';

/** Ordered: each seeder runs after the ones it depends on. */
export const SEEDERS = [
  { name: 'roles', run: seedRoles },
  { name: 'users', run: seedUsers },
  { name: 'categories', run: seedCategories },
  { name: 'products', run: seedProducts },
  { name: 'settings', run: seedSettings },
  { name: 'addresses', run: seedAddresses },
  { name: 'posts', run: seedPosts },
  { name: 'demo', run: seedDemo },
];

/**
 * Run the seeders in order.
 * @param {{ only?: string[], fresh?: boolean, log?: (line: string) => void }} [options] `fresh` lets demo seeders skip their "already exists" check
 */
export async function runSeeders({ only, fresh = false, log = console.log } = {}) {
  const unknown = (only ?? []).filter((name) => !SEEDERS.some((s) => s.name === name));
  if (unknown.length) throw new Error(`Unknown seeder: ${unknown.join(', ')}. Available: ${SEEDERS.map((s) => s.name).join(', ')}`);
  for (const seeder of SEEDERS) {
    if (only?.length && !only.includes(seeder.name)) continue;
    log(`[seed] ${seeder.name}: ${await seeder.run({ fresh })}`);
  }
  if (!only?.length || only.includes('users')) log(signInTable());
}
