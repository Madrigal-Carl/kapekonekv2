import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import '../../models/index.js';
import { runSeeders } from '../seeders/index.js';
import { runCommand } from './run.js';

/** Dropping production data needs an explicit --force. */
export function assertCanDropDatabase(nodeEnv, args) {
  if (nodeEnv === 'production' && !args.includes('--force')) {
    throw new Error('Refusing to drop the database in production. Re-run with --force if you really mean it.');
  }
}

/** Drop the database, rebuild every index, and optionally seed (`--seed`). */
export async function migrateFresh(args) {
  assertCanDropDatabase(env.NODE_ENV, args);
  await mongoose.connection.dropDatabase();
  await mongoose.syncIndexes();
  console.log(`[migrate:fresh] dropped "${mongoose.connection.name}" and rebuilt indexes`);
  if (args.includes('--seed')) await runSeeders({ fresh: true });
}

await runCommand(import.meta, migrateFresh);
