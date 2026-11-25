import { getBoundaries } from '../services/boundary.service.js';
import { getLocations } from '../services/location.service.js';
import * as settings from '../services/setting.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const locations = (_req, res) => sendSuccess(res, { data: getLocations() });

/** Public, cached a week; Express adds the ETag and answers If-None-Match with 304. */
export const boundaries = (req, res) => {
  res.set('Cache-Control', 'public, max-age=604800');
  sendSuccess(res, { data: getBoundaries(req.query) });
};

export const deliveryInfo = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await settings.getDeliveryInfo() });
});

export const landing = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await settings.getLanding() });
});

export const payment = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await settings.getPaymentSettings() });
});
