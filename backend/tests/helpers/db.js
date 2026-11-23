import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let server;

// A one-node replica set: the bean cap runs in a transaction (PHASE-2-SPEC §3.5), which standalone mongod refuses.
export async function startMemoryDb() {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(server.getUri());
}

export async function stopMemoryDb() {
  await mongoose.disconnect();
  await server?.stop();
}
