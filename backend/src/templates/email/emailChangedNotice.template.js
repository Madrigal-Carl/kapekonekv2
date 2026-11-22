import { renderLayout } from './layout.js';

/** Sent to the old address after an email change. @param {{ name: string, newEmail: string, url: string }} data */
export const emailChangedNotice = ({ name, newEmail, url }) => ({
  subject: 'Your KapeKonek email was changed',
  ...renderLayout({
    preheader: 'The email on your KapeKonek account was changed.',
    heading: 'Your email was changed',
    paragraphs: [
      `Hi ${name},`,
      `The email on your KapeKonek account was changed to ${newEmail}. Account emails won't come to this address anymore.`,
      "If you didn't make this change, reset your password right away and contact Kaluppa.",
    ],
    cta: { label: 'Reset password', url },
    footnote: 'You can ignore this email if you made the change.',
  }),
});
