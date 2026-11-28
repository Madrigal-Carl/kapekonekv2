import { Router } from 'express';
import { z } from 'zod';
import * as contact from '../controllers/contact.controller.js';
import { authenticate, optionalAuth } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { rateLimit } from '../middlewares/rateLimit.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { idParams, pageQuerySchema } from '../schemas/common.schema.js';
import { CONTACT_TOPICS, contactSchema } from '../schemas/rules.js';

// Contact us (Change 08): anyone may write; 3 messages an hour per IP and per email.
const LIMIT = { limit: 3, windowSec: 3600, message: 'You’ve sent 3 messages this hour. Please try again later.' };
const perIp = rateLimit({ name: 'contact-ip', ...LIMIT });
const perEmail = rateLimit({ name: 'contact-email', ...LIMIT, key: (req) => String(req.body?.email ?? '').trim().toLowerCase() || req.ip });
const listQuery = pageQuerySchema.extend({ q: z.string().trim().max(80).optional(), topic: z.enum(CONTACT_TOPICS, 'Pick a topic from the list').optional() });

const router = Router();
router.post('/contact', optionalAuth, perIp, perEmail, validate({ body: contactSchema }), contact.send);

// Kaluppa reads them in the dashboard (Contact messages).
router.use('/admin/contact-messages', authenticate, verified, can('contact.view'));
router.get('/admin/contact-messages', validate({ query: listQuery }), contact.list);
router.get('/admin/contact-messages/:id', validate({ params: idParams }), contact.show);

export default router;
