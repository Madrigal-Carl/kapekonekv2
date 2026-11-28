import { createContactMessage, findContactMessageById, listContactMessages } from '../repositories/contactMessage.repository.js';
import { EMAIL_JOBS } from '../queues/email.jobs.js';
import { enqueueEmail } from '../queues/email.queue.js';
import { AppError } from '../utils/AppError.js';
import { containsPattern } from '../utils/escapeRegex.js';
import { getSetting } from './setting.service.js';

// Contact us (Change 08, ContactUs.dc.html).

const toDto = ({ _id, name, email, phone, topic, orderNumber, message, user, createdAt }) => ({
  id: String(_id), name, email, phone, topic, orderNumber, message, signedIn: Boolean(user), createdAt,
});

/**
 * Save the message, email it to Settings → Branch contact email (when set) and a copy to the sender.
 * A filled honeypot (`website`) is accepted without saving or emailing, so bots learn nothing.
 * @param {object|null} user signed-in sender, if any
 * @param {import('zod').infer<typeof import('../schemas/rules.js').contactSchema>} body
 */
export async function sendContactMessage(user, { website, ...body }) {
  if (website) return { sent: true };
  const orderNumber = body.topic === 'An order' ? body.orderNumber : null;
  const saved = await createContactMessage({ ...body, orderNumber, user: user?._id ?? null });
  const branch = await getSetting('branch');
  const data = { name: body.name, email: body.email, phone: body.phone, topic: body.topic, orderNumber, message: body.message, branchName: branch.name };
  if (branch.contactEmail) await enqueueEmail(EMAIL_JOBS.CONTACT_MESSAGE, { ...data, to: branch.contactEmail });
  await enqueueEmail(EMAIL_JOBS.CONTACT_COPY, { ...data, to: body.email });
  return { sent: true, id: String(saved._id) };
}

/** Kaluppa's list (newest first), searchable, by topic. */
export async function listMessages({ q, topic, page, limit }) {
  const { items, meta } = await listContactMessages({ q: q ? containsPattern(q) : undefined, topic, page, limit });
  return { items: items.map(toDto), meta };
}

export async function getMessage(id) {
  const message = await findContactMessageById(id);
  if (!message) throw new AppError(404, 'We couldn’t find that message.');
  return toDto(message);
}
