import { renderLayout } from './layout.js';

/** @param {{ name: string, url: string }} data */
export const verifyEmail = ({ name, url }) => ({
  subject: 'Verify your KapeKonek email',
  ...renderLayout({
    preheader: 'Confirm your email to start ordering coffee.',
    heading: 'Verify your email',
    paragraphs: [`Hi ${name},`, 'Confirm this email address to unlock your cart, orders and profile on KapeKonek.'],
    cta: { label: 'Verify email', url },
    footnote: "This link works for 60 minutes. If you didn't create a KapeKonek account, you can ignore this email.",
  }),
});
