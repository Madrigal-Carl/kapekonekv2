import { Router } from 'express';
import cronRoutes from './cron.routes.js';
import healthRoutes from './health.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/cron', cronRoutes);

export default router;
