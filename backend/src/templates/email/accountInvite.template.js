import { renderLayout } from './layout.js';

/** @param {{ name: string, url: string }} data */
export const accountInvite = ({ name, url }) => ({
  subject: 'Your KapeKonek account is ready',
  ...renderLayout({
    preheader: 'Set your password to start using KapeKonek.',
    heading: 'Welcome to KapeKonek',
    paragraphs: [`Hi ${name},`, 'Kaluppa created a KapeKonek account for you. Set your password to sign in to your dashboard.'],
    cta: { label: 'Set your password', url },
    footnote: 'This link works for 60 minutes and only once. If it expires, use "Forgot password" on the sign-in page.',
  }),
});
