import { Router } from 'express';
import { z } from 'zod';
import * as posts from '../controllers/post.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import { idParams, pageQuery } from '../schemas/common.schema.js';

// Read-only in Phase 1: posting, reacting and commenting arrive with the Phase 2 dashboards.
const router = Router();

const latestQuery = z.object({ limit: z.coerce.number().int().min(1).max(6, 'At most 6 posts').default(3) });

router.get('/posts/latest', optionalAuth, validate({ query: latestQuery }), posts.latest);
router.get('/posts/:id', optionalAuth, validate({ params: idParams }), posts.show);
router.get('/posts/:id/comments', optionalAuth, validate({ params: idParams, query: pageQuery(20, 5) }), posts.comments);
router.get('/comments/:id/replies', optionalAuth, validate({ params: idParams, query: pageQuery(20, 10) }), posts.replies);

export default router;
