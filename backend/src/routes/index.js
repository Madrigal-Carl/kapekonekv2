import { Router } from 'express';
import authRoutes from './auth.routes.js';
import cronRoutes from './cron.routes.js';
import healthRoutes from './health.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/cron', cronRoutes);
router.use('/auth', authRoutes);

export default router;
