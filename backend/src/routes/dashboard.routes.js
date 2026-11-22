import { Router } from 'express';
import * as dashboard from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { verified } from '../middlewares/verified.middleware.js';

const router = Router();
router.use('/dashboard', authenticate, verified, can('dashboard.view'));
router.get('/dashboard/badges', dashboard.badges);
router.get('/dashboard/overview', dashboard.overview);

export default router;
