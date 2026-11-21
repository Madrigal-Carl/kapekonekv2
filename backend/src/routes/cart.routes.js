import { Router } from 'express';
import * as cart from '../controllers/cart.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { addItemSchema, productIdParams, setQuantitySchema, uploadSignatureSchema } from '../schemas/cart.schema.js';

const router = Router();
router.use('/cart', authenticate, verified, can('cart.manage'));

router.get('/cart', cart.show);
router.delete('/cart', cart.clear);
router.post('/cart/items', validate({ body: addItemSchema }), cart.add);
router.patch('/cart/items/:productId', validate({ params: productIdParams, body: setQuantitySchema }), cart.setQuantity);
router.delete('/cart/items/:productId', validate({ params: productIdParams }), cart.remove);

router.post('/uploads/signature', authenticate, verified, validate({ body: uploadSignatureSchema }), cart.uploadSignature);

export default router;
