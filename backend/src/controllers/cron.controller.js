import { runOrderExpiry } from '../services/orderExpiry.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const expireOrders = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await runOrderExpiry() });
});
