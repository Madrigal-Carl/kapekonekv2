import { runSeeders } from '../seeders/index.js';
import { runCommand } from './run.js';

/** `npm run db:seed [-- --only=roles,users]` */
await runCommand(import.meta, (args) => {
  const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',').filter(Boolean);
  return runSeeders({ only });
});
