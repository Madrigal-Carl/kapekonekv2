import { Router } from 'express';
import * as adminOrders from '../controllers/adminOrder.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { exportLimit } from '../middlewares/rateLimit.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { adminOrderExportQuery, adminOrderListQuery } from '../schemas/order.schema.js';

// Kaluppa's Orders table. Status changes and refunds stay on Phase 1's PATCH /orders/:id/status|refund.
const router = Router();
router.use('/admin/orders', authenticate, verified, can('orders.manage'));
router.get('/admin/orders', validate({ query: adminOrderListQuery }), adminOrders.list);
router.get('/admin/orders/export', exportLimit, validate({ query: adminOrderExportQuery }), adminOrders.exportFile);

export default router;
