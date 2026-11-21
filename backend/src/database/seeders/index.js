import { seedRoles } from './roles.seeder.js';
import { seedUsers } from './users.seeder.js';

/** Ordered: each seeder runs after the ones it depends on. M3+ append categories, products, settings, … */
export const SEEDERS = [
  { name: 'roles', run: seedRoles },
  { name: 'users', run: seedUsers },
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
}
