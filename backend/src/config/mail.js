import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BrevoClient } from '@getbrevo/brevo';
import { env } from './env.js';

export const MAIL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../storage/mail');

let brevo;

/**
 * Deliver one email through the configured transport.
 * `log` writes `storage/mail/<timestamp>-<to>.json` for local dev and tests.
 * @param {{ to: string, subject: string, html: string, text: string }} message
 * @returns {Promise<string | void>} the written file path in log mode
 */
export async function sendMail({ to, subject, html, text }) {
  if (env.MAIL_TRANSPORT === 'log') {
    await mkdir(MAIL_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(MAIL_DIR, `${stamp}-${to.replace(/[^a-z0-9@._-]/gi, '_')}.json`);
    await writeFile(file, JSON.stringify({ to, subject, text, html, sentAt: new Date().toISOString() }, null, 2));
    return file;
  }
  brevo ??= new BrevoClient({ apiKey: env.BREVO_API_KEY });
  await brevo.transactionalEmails.sendTransacEmail({
    sender: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text,
  });
}
