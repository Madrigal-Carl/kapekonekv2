import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { inject } from 'vitest';

/** Connect this test file to a database of its own on the shared replica set (tests/globalSetup.js). */
export async function startMemoryDb() {
  await mongoose.connect(inject('mongoUri'), { dbName: `test-${randomUUID()}` });
  // Each file gets a fresh database: wait for the unique indexes, or a busy machine runs tests before they exist.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function stopMemoryDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
