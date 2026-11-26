import { Worker } from 'bullmq';
import { createValkeyConnection } from '../../config/valkey.js';
import { expireBeanListings } from '../../services/bean.service.js';
import { refreshTopPosts } from '../../services/post.service.js';
import { JOBS, JOBS_QUEUE } from '../jobs.queue.js';

/** Job name → handler. Handlers are idempotent: a job that runs twice changes nothing the second time. */
const handlers = {
  [JOBS.BEANS_EXPIRE]: () => expireBeanListings(new Date()),
  [JOBS.POSTS_TOP3]: async () => ({ top: (await refreshTopPosts(new Date())).length }),
};

/** @param {{ name: string }} job */
export async function processJob({ name }) {
  const handler = handlers[name];
  if (!handler) throw new Error(`Unknown job: ${name}`);
  return handler();
}

let worker;

export function startJobsWorker() {
  worker = new Worker(JOBS_QUEUE, processJob, { connection: createValkeyConnection('jobs-worker') });
  worker.on('completed', (job, result) => { if (result?.expired) console.log(`[jobs] ${job.name}`, result); });
  worker.on('failed', (job, error) => console.error(`[jobs] ${job?.name} failed: ${error.message}`));
  return worker;
}

export async function closeJobsWorker() {
  await worker?.close();
  worker = undefined;
}
