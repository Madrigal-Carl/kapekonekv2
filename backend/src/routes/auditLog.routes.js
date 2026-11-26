import { Router } from 'express';
import * as auditLogs from '../controllers/auditLog.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { auditExportQuery, auditListQuery, entityHistoryParams, entityHistoryQuery } from '../schemas/auditLog.schema.js';
import { idParams } from '../schemas/common.schema.js';

const router = Router();

// A record's History (drawers): whoever may view the record; the service checks the record's own permission and policy.
router.get('/audit-logs/entity/:entityType/:entityId', authenticate, verified, validate({ params: entityHistoryParams, query: entityHistoryQuery }), auditLogs.entityHistory);

// The audit log itself (PHASE-2-SPEC §3.12): Kaluppa only, read-only.
const auditView = [authenticate, verified, can('audit.view')];
router.get('/audit-logs', ...auditView, validate({ query: auditListQuery }), auditLogs.list);
router.get('/audit-logs/export.csv', ...auditView, validate({ query: auditExportQuery }), auditLogs.exportCsv);
router.get('/audit-logs/:id', ...auditView, validate({ params: idParams }), auditLogs.show);

export default router;
