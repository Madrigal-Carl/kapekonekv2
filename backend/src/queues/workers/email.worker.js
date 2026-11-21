import { Worker } from 'bullmq';
import { sendMail } from '../../config/mail.js';
import { createValkeyConnection } from '../../config/valkey.js';
import { resetPassword } from '../../templates/email/resetPassword.template.js';
import { testEmail } from '../../templates/email/test.template.js';
import { verifyEmail } from '../../templates/email/verifyEmail.template.js';
import { EMAIL_JOBS } from '../email.jobs.js';
import { EMAIL_QUEUE } from '../email.queue.js';

/** Job name → (data) => { subject, html, text }. */
const handlers = {
  [EMAIL_JOBS.TEST]: testEmail,
  [EMAIL_JOBS.VERIFY_EMAIL]: verifyEmail,
  [EMAIL_JOBS.RESET_PASSWORD]: resetPassword,
};

/**
 * Render and send one email job.
 * @param {{ name: string, data: { to: string } }} job
 */
export async function processEmailJob({ name, data }) {
  const render = handlers[name];
  if (!render) throw new Error(`Unknown email job: ${name}`);
  return sendMail({ to: data.to, ...render(data) });
}

let worker;

export function startEmailWorker() {
  worker = new Worker(EMAIL_QUEUE, processEmailJob, { connection: createValkeyConnection('email-worker') });
  // Log the reason only; job data holds addresses and links.
  worker.on('failed', (job, error) =>
    console.error(`[email] ${job?.name} #${job?.id} failed (attempt ${job?.attemptsMade}): ${error.message}`),
  );
  return worker;
}

export async function closeEmailWorker() {
  await worker?.close();
  worker = undefined;
}
