import { Router } from 'express';
import * as posts from '../controllers/post.controller.js';
import { authenticate, optionalAuth } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { idParams, pageQuery } from '../schemas/common.schema.js';
import { commentEditSchema, commentSchema, feedQuery, postSchema, reactionSchema, removeSchema } from '../schemas/post.schema.js';

// Reading is public for the landing page's top 3 (post.service decides who sees what); the Hub needs the dashboard permissions.
const router = Router();
const member = (...slugs) => [authenticate, verified, can(...slugs)];

router.get('/posts/top', posts.top);
router.get('/posts/:id', optionalAuth, validate({ params: idParams }), posts.show);
router.get('/posts/:id/comments', optionalAuth, validate({ params: idParams, query: pageQuery(20, 5) }), posts.comments);
router.get('/comments/:id/replies', optionalAuth, validate({ params: idParams, query: pageQuery(20, 10) }), posts.replies);

router.post('/posts/:id/comments', member('posts.comment'), validate({ params: idParams, body: commentSchema }), posts.addComment);
router.patch('/comments/:id', member('posts.comment'), validate({ params: idParams, body: commentEditSchema }), posts.editComment);
router.delete('/comments/:id', member('posts.comment'), validate({ params: idParams }), posts.deleteComment);
router.post('/comments/:id/remove', member('posts.moderate'), validate({ params: idParams, body: removeSchema }), posts.removeComment);
router.put('/posts/:id/reaction', member('posts.react'), validate({ params: idParams, body: reactionSchema }), posts.reactPost);
router.delete('/posts/:id/reaction', member('posts.react'), validate({ params: idParams }), posts.unreactPost);
router.put('/comments/:id/reaction', member('posts.react'), validate({ params: idParams, body: reactionSchema }), posts.reactComment);
router.delete('/comments/:id/reaction', member('posts.react'), validate({ params: idParams }), posts.unreactComment);

router.get('/hub/posts', member('dashboard.view'), validate({ query: feedQuery }), posts.feed);
router.get('/hub/tags', member('dashboard.view'), posts.tags);
router.post('/hub/posts', member('posts.create'), validate({ body: postSchema }), posts.create);
router.patch('/hub/posts/:id', member('posts.create'), validate({ params: idParams, body: postSchema }), posts.update);
router.delete('/hub/posts/:id', member('posts.create'), validate({ params: idParams }), posts.destroy);
router.post('/hub/posts/:id/remove', member('posts.moderate'), validate({ params: idParams, body: removeSchema }), posts.remove);
// Any signed-in, verified person who may open the post (buyers on the top 3 too); the service checks which posts.
router.post('/hub/posts/:id/view', authenticate, verified, validate({ params: idParams }), posts.view);

export default router;
