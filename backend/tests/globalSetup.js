import { MongoMemoryReplSet } from 'mongodb-memory-server';

/**
 * One in-memory single-node replica set for the whole run (the bean cap needs transactions, which standalone mongod
 * refuses); each test file gets its own database on it (helpers/db.js). One mongod instead of one per file keeps
 * memory flat when many files run at once. The first run also downloads mongod (~80 MB) here, not in a hook.
 */
export default async function setup({ provide }) {
  const server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' }, instanceOpts: [{ launchTimeout: 60_000 }] });
  provide('mongoUri', server.getUri());
  return () => server.stop();
}
