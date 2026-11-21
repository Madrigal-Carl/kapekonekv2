import { MongoBinary } from 'mongodb-memory-server';

// Download mongod (~80 MB) once before any test, so a first run never times out a beforeAll hook.
export default async function setup() {
  await MongoBinary.getPath();
}
