import { Worker } from 'bullmq';
import { env } from '../../config/env.js';
import { logMail, sendMail } from '../../config/mail.js';
import { createValkeyConnection } from '../../config/valkey.js';
import { isSeedEmail } from '../../repositories/user.repository.js';
import { accountInvite } from '../../templates/email/accountInvite.template.js';
import { farmerDecision, farmerRequest, transferDecision } from '../../templates/email/farmer.templates.js';
import { emailChangedNotice } from '../../templates/email/emailChangedNotice.template.js';
import { kaluppaNewOrder } from '../../templates/email/kaluppaNewOrder.template.js';
import { orderPlaced } from '../../templates/email/orderPlaced.template.js';
import { beanStatus } from '../../templates/email/beanStatus.template.js';
import { orderStatusChanged } from '../../templates/email/orderStatusChanged.template.js';
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
  [EMAIL_JOBS.ACCOUNT_INVITE]: accountInvite,
  [EMAIL_JOBS.FARMER_REQUEST]: farmerRequest,
  [EMAIL_JOBS.FARMER_DECISION]: farmerDecision,
  [EMAIL_JOBS.TRANSFER_DECISION]: transferDecision,
  [EMAIL_JOBS.EMAIL_CHANGED_NOTICE]: emailChangedNotice,
  [EMAIL_JOBS.ORDER_PLACED]: orderPlaced,
  [EMAIL_JOBS.KALUPPA_NEW_ORDER]: kaluppaNewOrder,
  [EMAIL_JOBS.ORDER_STATUS_CHANGED]: orderStatusChanged,
  [EMAIL_JOBS.BEAN_STATUS]: beanStatus,
};

/**
 * Render and send one email job. Seed accounts are never emailed unless SEED_EMAIL_BASE points them at your own inbox.
 * @param {{ name: string, data: { to: string } }} job
 */
export async function processEmailJob({ name, data }) {
  const render = handlers[name];
  if (!render) throw new Error(`Unknown email job: ${name}`);
  const message = { to: data.to, ...render(data) };
  if (!env.SEED_EMAIL_BASE && (await isSeedEmail(data.to))) return logMail(message, 'skipped-seed');
  return sendMail(message);
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
