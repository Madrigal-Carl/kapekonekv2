import { Queue } from 'bullmq';
import { createValkeyConnection } from '../config/valkey.js';
import { EMAIL_JOBS } from './email.jobs.js';

export const EMAIL_QUEUE = 'email';
const JOB_NAMES = new Set(Object.values(EMAIL_JOBS));

let queue;
const getQueue = () =>
  (queue ??= new Queue(EMAIL_QUEUE, {
    connection: createValkeyConnection('email-queue'),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }));

/**
 * Queue an email. Every email goes through here.
 * @param {string} job one of EMAIL_JOBS
 * @param {object} data the handler's input (must include `to`)
 */
export async function enqueueEmail(job, data) {
  if (!JOB_NAMES.has(job)) throw new Error(`Unknown email job: ${job}`);
  if (!data.to) return; // accounts a Group Manager created may have no email
  await getQueue().add(job, data);
}

export async function closeEmailQueue() {
  await queue?.close();
  queue = undefined;
}
