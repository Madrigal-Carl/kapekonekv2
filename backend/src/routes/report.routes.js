import { Router } from 'express';
import * as reports from '../controllers/report.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { reportExportQuery, reportParams, reportQuery } from '../schemas/report.schema.js';

const router = Router();

// Kaluppa: every association; a Group Manager: its own (report.service forces the scope). Store sales need orders.manage.
router.use('/reports', authenticate, verified, can('reports.view'));
router.get('/reports/export.csv', validate({ query: reportExportQuery }), reports.exportCsv);
router.get('/reports/:section', validate({ params: reportParams, query: reportQuery }), reports.show);

export default router;
