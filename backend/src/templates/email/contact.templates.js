import { renderLayout } from './layout.js';

// Contact us emails (Change 08). renderLayout escapes every line, so the sender's text is safe.

const details = ({ name, email, phone, topic, orderNumber }) =>
  [`From: ${name} <${email}>`, phone && `Phone: ${phone}`, `Topic: ${topic}`, orderNumber && `Order number: ${orderNumber}`].filter(Boolean);

/** To the branch's contact email (Settings → Branch). */
export function contactMessage(data) {
  return {
    subject: `Contact us: ${data.topic} — ${data.name}`,
    ...renderLayout({
      preheader: data.message.slice(0, 90),
      heading: 'New message from Contact us',
      paragraphs: [...details(data), data.message],
      footnote: `Reply to ${data.email} to answer.`,
    }),
  };
}

/** The sender's copy. */
export function contactCopy(data) {
  return {
    subject: `We got your message — ${data.branchName}`,
    ...renderLayout({
      preheader: 'A copy of what you sent us',
      heading: 'We got your message',
      paragraphs: [`Hi ${data.name.split(' ')[0]},`, `Thanks for writing to ${data.branchName}. We’ll reply by email within 1–2 business days. Here’s a copy of your message:`, `Topic: ${data.topic}${data.orderNumber ? ` · Order ${data.orderNumber}` : ''}`, data.message],
    }),
  };
}
