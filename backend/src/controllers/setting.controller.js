import { getLocations } from '../services/location.service.js';
import * as settings from '../services/setting.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const locations = (_req, res) => sendSuccess(res, { data: getLocations() });

export const deliveryInfo = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await settings.getDeliveryInfo() });
});

export const landing = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await settings.getLanding() });
});

export const payment = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await settings.getPaymentSettings() });
});
