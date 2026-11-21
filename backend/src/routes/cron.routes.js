import { Router } from 'express';
import { expireOrders } from '../controllers/cron.controller.js';
import { requireCronSecret } from '../middlewares/cronSecret.middleware.js';

const router = Router();

router.post('/expire-orders', requireCronSecret, expireOrders);

export default router;
