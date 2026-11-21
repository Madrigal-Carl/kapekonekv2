import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let server;

export async function startMemoryDb() {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
}

export async function stopMemoryDb() {
  await mongoose.disconnect();
  await server?.stop();
}
