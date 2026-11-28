import { Router } from 'express';
import * as moderation from '../controllers/reviewModeration.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { idParams } from '../schemas/common.schema.js';
import { adminReviewListQuery, hideReviewSchema, replySchema } from '../schemas/review.schema.js';

// Kaluppa's review moderation (PHASE-2-SPEC §3.8b). Kaluppa never edits what a reviewer wrote.
const router = Router();
router.use('/admin/reviews', authenticate, verified, can('reviews.moderate'));
router.get('/admin/reviews', validate({ query: adminReviewListQuery }), moderation.list);
router.get('/admin/reviews/products', moderation.products);
router.get('/admin/reviews/:id', validate({ params: idParams }), moderation.show);
router.put('/admin/reviews/:id/reply', validate({ params: idParams, body: replySchema }), moderation.reply);
router.delete('/admin/reviews/:id/reply', validate({ params: idParams }), moderation.deleteReply);
router.post('/admin/reviews/:id/hide', validate({ params: idParams, body: hideReviewSchema }), moderation.hide);
router.post('/admin/reviews/:id/unhide', validate({ params: idParams }), moderation.unhide);

export default router;
