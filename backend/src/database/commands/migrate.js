import mongoose from 'mongoose';
import { MIGRATIONS } from '../migrations/index.js';
import { runCommand } from './run.js';

/** Run each migration not yet recorded in the `migrations` collection, oldest first. @returns {Promise<string[]>} the names run */
export async function migrate() {
  const { db } = mongoose.connection;
  const done = db.collection('migrations');
  const ran = [];
  for (const migration of MIGRATIONS) {
    if (await done.findOne({ name: migration.name })) continue;
    await migration.up(db);
    await done.insertOne({ name: migration.name, ranAt: new Date() });
    console.log(`[migrate] ${migration.name}`);
    ran.push(migration.name);
  }
  return ran;
}

await runCommand(import.meta, migrate);
