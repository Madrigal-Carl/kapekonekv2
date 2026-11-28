import { renderLayout } from './layout.js';

/** A new account made by Kaluppa or a Group Manager (Change 08): sign in with the default password, verify first. */
export const accountCreated = ({ name, creatorName, username, password, url }) => ({
  subject: 'Your KapeKonek account is ready: verify your email',
  ...renderLayout({
    preheader: 'Verify your email, then sign in with the default password.',
    heading: 'Welcome to KapeKonek',
    paragraphs: [
      `Hi ${name},`,
      `${creatorName} created a KapeKonek account for you. Verify your email to open your dashboard.`,
      `Sign in with your username @${username} or this email, and the default password ${password}. Change it in Settings → Security after you verify.`,
    ],
    cta: { label: 'Verify my email', url },
    footnote: 'This link works for 60 minutes. You can send a new one from the Verify email page after you sign in.',
  }),
});

/** Kaluppa or a Group Manager reset the password to the default; every session ended. */
export const passwordResetByAdmin = ({ name, byName, password, url }) => ({
  subject: 'Your KapeKonek password was reset',
  ...renderLayout({
    preheader: 'Sign in again with the default password.',
    heading: 'Your password was reset',
    paragraphs: [
      `Hi ${name},`,
      `${byName} reset your KapeKonek password to the default, ${password}. You were signed out on every device.`,
      'Sign in again, then change your password in Settings → Security.',
    ],
    cta: { label: 'Sign in', url },
    footnote: 'If you didn’t ask for this, contact Kaluppa.',
  }),
});
