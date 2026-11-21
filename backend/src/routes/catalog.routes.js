import { Router } from 'express';
import * as catalog from '../controllers/catalog.controller.js';
import { authenticate, optionalAuth } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import {
  createReviewSchema, idParams, pageQuery, productListQuery, slugParams, updateReviewSchema,
} from '../schemas/catalog.schema.js';

const router = Router();

router.get('/categories', optionalAuth, catalog.categories);
router.get('/products', optionalAuth, validate({ query: productListQuery }), catalog.products);
router.get('/products/:slug', optionalAuth, validate({ params: slugParams }), catalog.product);

router.get('/products/:id/reviews', optionalAuth, validate({ params: idParams, query: pageQuery(20, 5) }), catalog.productReviews);
router.get('/products/:id/reviews/summary', optionalAuth, validate({ params: idParams }), catalog.reviewSummary);
router.get('/products/:id/reviews/me', authenticate, verified, validate({ params: idParams }), catalog.myReview);
router.post('/products/:id/reviews', authenticate, verified, can('reviews.create'), validate({ params: idParams, body: createReviewSchema }), catalog.createReview);
router.patch('/reviews/:id', authenticate, verified, can('reviews.update_own'), validate({ params: idParams, body: updateReviewSchema }), catalog.updateReview);

export default router;
