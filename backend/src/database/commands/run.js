import { pathToFileURL } from 'node:url';
import { connectDb, disconnectDb } from '../../config/db.js';
import { closeValkeyConnections } from '../../config/valkey.js';

/** Run `main` only when `meta` is the entry script; always close connections; exit 1 on failure. */
export async function runCommand(meta, main) {
  if (meta.url !== pathToFileURL(process.argv[1]).href) return;
  let code = 0;
  try {
    await connectDb();
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    code = 1;
  } finally {
    await closeValkeyConnections();
    await disconnectDb();
  }
  process.exit(code);
}
