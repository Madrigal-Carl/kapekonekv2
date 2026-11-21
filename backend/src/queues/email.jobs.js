/** BullMQ job names for the email queue. Each one has a handler in workers/email.worker.js. */
export const EMAIL_JOBS = Object.freeze({
  TEST: 'test',
  VERIFY_EMAIL: 'verify-email',
  RESET_PASSWORD: 'reset-password',
});
