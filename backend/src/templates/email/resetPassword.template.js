import { renderLayout } from './layout.js';

/** @param {{ name: string, url: string }} data */
export const resetPassword = ({ name, url }) => ({
  subject: 'Reset your KapeKonek password',
  ...renderLayout({
    preheader: 'Choose a new password for KapeKonek.',
    heading: 'Reset your password',
    paragraphs: [`Hi ${name},`, "We got a request to reset your KapeKonek password. You'll be signed out of other devices after you choose a new one."],
    cta: { label: 'Choose a new password', url },
    footnote: "This link works for 60 minutes and only once. If you didn't ask for it, you can ignore this email.",
  }),
});
