import { Router } from 'express';
import addressRoutes from './address.routes.js';
import authRoutes from './auth.routes.js';
import cartRoutes from './cart.routes.js';
import catalogRoutes from './catalog.routes.js';
import cronRoutes from './cron.routes.js';
import geoRoutes from './geo.routes.js';
import healthRoutes from './health.routes.js';
import orderRoutes from './order.routes.js';
import postRoutes from './post.routes.js';
import settingRoutes from './setting.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/cron', cronRoutes);
router.use('/auth', authRoutes);
router.use(catalogRoutes);
router.use(settingRoutes);
router.use(postRoutes);
router.use(geoRoutes);
router.use(addressRoutes);
router.use(cartRoutes);
router.use(orderRoutes);

export default router;
