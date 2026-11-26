import { Router } from 'express';
import * as auditLogs from '../controllers/auditLog.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { entityHistoryParams, entityHistoryQuery } from '../schemas/auditLog.schema.js';

const router = Router();

// A record's History (drawers): whoever may view the record; the service checks the record's own permission and policy.
router.get('/audit-logs/entity/:entityType/:entityId', authenticate, verified, validate({ params: entityHistoryParams, query: entityHistoryQuery }), auditLogs.entityHistory);

export default router;
