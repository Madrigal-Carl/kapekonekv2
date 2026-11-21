import { renderLayout } from './layout.js';

/** @param {{ name?: string }} data */
export const testEmail = ({ name }) => ({
  subject: 'KapeKonek test email',
  ...renderLayout({
    preheader: 'The email queue works.',
    heading: 'Hello from KapeKonek',
    paragraphs: [`Hi ${name || 'there'},`, 'This test email went through the queue and the worker.'],
  }),
});
