import { getHealth } from '../services/health.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// 503 lets Render's health check see a broken dependency.
export const health = asyncHandler(async (_req, res) => {
  const data = await getHealth();
  res.status(data.status === 'ok' ? 200 : 503).json({ success: data.status === 'ok', data });
});
