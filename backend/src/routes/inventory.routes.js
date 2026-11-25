import { Router } from 'express';
import * as inventory from '../controllers/inventory.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { idParams } from '../schemas/common.schema.js';
import { productListQuery, productSchema } from '../schemas/product.schema.js';

// Kaluppa's Inventory (PHASE-2-SPEC §4).
const router = Router();
router.use('/admin/products', authenticate, verified, can('inventory.manage'));
router.get('/admin/products', validate({ query: productListQuery }), inventory.list);
router.post('/admin/products', validate({ body: productSchema }), inventory.create);
router.get('/admin/products/:id', validate({ params: idParams }), inventory.show);
router.patch('/admin/products/:id', validate({ params: idParams, body: productSchema }), inventory.update);
router.post('/admin/products/:id/archive', validate({ params: idParams }), inventory.archive);
router.post('/admin/products/:id/restore', validate({ params: idParams }), inventory.restore);

export default router;
