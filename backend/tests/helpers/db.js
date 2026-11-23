import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { inject } from 'vitest';

/** Connect this test file to a database of its own on the shared replica set (tests/globalSetup.js). */
export async function startMemoryDb() {
  await mongoose.connect(inject('mongoUri'), { dbName: `test-${randomUUID()}` });
}

export async function stopMemoryDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
