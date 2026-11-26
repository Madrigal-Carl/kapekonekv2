import { Router } from 'express';
import * as inbox from '../controllers/inbox.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { idParams } from '../schemas/common.schema.js';
import { conversationListQuery, directSchema, messageDeleteQuery, messageEditSchema, messageSchema, messagesQuery, peopleQuery } from '../schemas/inbox.schema.js';

const router = Router();

// Membership (whose chat) is checked in inbox.service (PHASE-2-SPEC §3.9).
router.use(['/conversations', '/messages', '/inbox'], authenticate, verified, can('inbox.use'));
router.get('/conversations', validate({ query: conversationListQuery }), inbox.list);
router.post('/conversations/direct', validate({ body: directSchema }), inbox.direct);
router.get('/conversations/:id', validate({ params: idParams }), inbox.show);
router.get('/conversations/:id/messages', validate({ params: idParams, query: messagesQuery }), inbox.messages);
router.post('/conversations/:id/messages', validate({ params: idParams, body: messageSchema }), inbox.send);
router.post('/conversations/:id/read', validate({ params: idParams }), inbox.read);
router.patch('/messages/:id', validate({ params: idParams, body: messageEditSchema }), inbox.edit);
router.delete('/messages/:id', validate({ params: idParams, query: messageDeleteQuery }), inbox.remove);
router.get('/inbox/people', validate({ query: peopleQuery }), inbox.people);

export default router;
