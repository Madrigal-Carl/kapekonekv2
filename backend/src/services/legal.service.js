import { readFile } from 'node:fs/promises';
import { TERMS_UPDATED_AT, TERMS_VERSION } from '../constants/legal.js';
import { acceptTermsFor } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { record } from './audit.service.js';

const LEGAL_DIR = new URL('../legal/', import.meta.url);

/** "## Heading\n\nParagraph…" → [{ heading, paragraphs }]. Comments (the draft note) are dropped. */
export function parseSections(markdown) {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/^## /m)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [heading, ...rest] = chunk.split('\n');
      return { heading: heading.trim(), paragraphs: rest.join('\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) };
    });
}

let cached;
/** The current Terms and Conditions and Privacy Policy, read once from src/legal/*.v<TERMS_VERSION>.md. */
export async function getCurrentLegal() {
  cached ??= Promise.all(['terms', 'privacy'].map((name) => readFile(new URL(`${name}.v${TERMS_VERSION}.md`, LEGAL_DIR), 'utf8'))).then(([terms, privacy]) => ({
    version: TERMS_VERSION,
    updatedAt: TERMS_UPDATED_AT,
    terms: parseSections(terms),
    privacy: parseSections(privacy),
  }));
  return cached;
}

/**
 * Store that `user` agreed to the current version (sign-up, or the accept step after sign-in), with an audit entry.
 * @param {object} user
 * @param {number} version the version the user read; refused when the terms changed meanwhile
 */
export async function acceptTerms(user, version = TERMS_VERSION) {
  if (version !== TERMS_VERSION) throw new AppError(409, 'The terms were updated. Read the new version and agree again.', { code: 'CONFLICT' });
  const before = { termsVersion: user.termsVersion ?? 0 };
  const after = await acceptTermsFor(user._id, TERMS_VERSION);
  await record({
    actor: user,
    area: 'accounts',
    action: 'accept_terms',
    entity: { type: 'user', id: user._id, label: `${user.firstName} ${user.lastName}` },
    before,
    after: { termsVersion: TERMS_VERSION },
    fields: ['termsVersion'],
  });
  return after;
}
