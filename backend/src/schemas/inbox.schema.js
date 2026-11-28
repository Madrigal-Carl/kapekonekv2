import { z } from 'zod';
import { objectIdRule } from './common.schema.js';
import { messageBodyRule } from './rules.js';

export const conversationListQuery = z.object({
  filter: z.enum(['all', 'unread', 'groups'], 'Pick All, Unread or Groups').default('all'),
  q: z.string().trim().max(100).optional(),
});

export const peopleQuery = z.object({ q: z.string().trim().max(100).optional() });

/** A user id, or `kaluppa` for the Kaluppa team. */
export const directSchema = z.object({ userId: z.union([z.literal('kaluppa'), objectIdRule], 'Pick someone to message') });

export const messagesQuery = z.object({
  before: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50, 'At most 50 per page').default(30),
});

const attachmentRule = z.object({ url: z.url('Upload the file again'), publicId: z.string().min(1).max(300) });

export const messageSchema = z
  .object({
    body: messageBodyRule.default(''),
    attachments: z.array(attachmentRule).max(5, 'Attach up to 5 files').default([]),
    replyTo: objectIdRule.nullish(),
  })
  .refine((m) => m.body || m.attachments.length, { path: ['body'], message: 'Write a message or attach a file' });

export const messageEditSchema = z.object({ body: messageBodyRule.min(1, 'Write a message') });

export const messageDeleteQuery = z.object({ for: z.enum(['everyone', 'me'], 'Pick everyone or me') });
