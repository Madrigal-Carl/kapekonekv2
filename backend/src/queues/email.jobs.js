/** BullMQ job names for the email queue. Each one has a handler in workers/email.worker.js. */
export const EMAIL_JOBS = Object.freeze({
  TEST: 'test',
  VERIFY_EMAIL: 'verify-email',
  RESET_PASSWORD: 'reset-password',
  ACCOUNT_CREATED: 'account-created',
  PASSWORD_RESET_BY_ADMIN: 'password-reset-by-admin',
  FARMER_REQUEST: 'farmer-request',
  FARMER_DECISION: 'farmer-decision',
  TRANSFER_DECISION: 'transfer-decision',
  EMAIL_CHANGED_NOTICE: 'email-changed-notice',
  ORDER_PLACED: 'order-placed',
  KALUPPA_NEW_ORDER: 'kaluppa-new-order',
  ORDER_STATUS_CHANGED: 'order-status-changed',
  BEAN_STATUS: 'bean-status',
  CONTACT_MESSAGE: 'contact-message',
  CONTACT_COPY: 'contact-copy',
});
