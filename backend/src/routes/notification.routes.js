import { Router } from 'express';
import * as notifications from '../controllers/notification.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { idParams, pageQuery } from '../schemas/common.schema.js';

const router = Router();
router.use('/notifications', authenticate, verified, can('notifications.view'));

router.get('/notifications', validate({ query: pageQuery(50, 15) }), notifications.list);
router.get('/notifications/unread-count', notifications.unreadCount);
router.patch('/notifications/read-all', notifications.markAllRead);
router.patch('/notifications/:id/read', validate({ params: idParams }), notifications.markRead);

export default router;
