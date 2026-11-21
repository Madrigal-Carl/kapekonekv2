import { Router } from 'express';
import * as geo from '../controllers/geo.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { rateLimit } from '../middlewares/rateLimit.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { pointQuery, quoteQuery, searchQuery } from '../schemas/geo.schema.js';

const router = Router();
const geoLimit = rateLimit({ name: 'geo', limit: 30, windowSec: 60, key: (req) => String(req.user._id) });

router.get('/geo/reverse', authenticate, verified, geoLimit, validate({ query: pointQuery }), geo.reverse);
router.get('/geo/search', authenticate, verified, geoLimit, validate({ query: searchQuery }), geo.search);
router.get('/delivery/quote', authenticate, verified, validate({ query: quoteQuery }), geo.quote);

export default router;
