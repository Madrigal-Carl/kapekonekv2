import { Queue } from 'bullmq';
import { createValkeyConnection } from '../config/valkey.js';

/** Background jobs other than email (PHASE-2-SPEC §6). Each one has a handler in workers/jobs.worker.js. */
export const JOBS_QUEUE = 'jobs';
export const JOBS = Object.freeze({ BEANS_EXPIRE: 'beans:expire', POSTS_TOP3: 'posts:top3', PRODUCTS_BEST8: 'products:best8' });
const HOUR = 3_600_000;

let queue;
const getQueue = () => (queue ??= new Queue(JOBS_QUEUE, { connection: createValkeyConnection('jobs-queue'), defaultJobOptions: { removeOnComplete: true, removeOnFail: { age: 7 * 24 * 3600 } } }));

/** Register the repeating jobs. Upserting by a fixed id keeps one schedule however often the API restarts. */
export async function scheduleRepeatingJobs() {
  await getQueue().upsertJobScheduler(JOBS.BEANS_EXPIRE, { every: HOUR }, { name: JOBS.BEANS_EXPIRE });
  await getQueue().upsertJobScheduler(JOBS.POSTS_TOP3, { every: HOUR }, { name: JOBS.POSTS_TOP3 });
  await getQueue().upsertJobScheduler(JOBS.PRODUCTS_BEST8, { every: 24 * HOUR }, { name: JOBS.PRODUCTS_BEST8 });
}

export async function closeJobsQueue() {
  await queue?.close();
  queue = undefined;
}
