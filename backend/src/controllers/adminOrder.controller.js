import * as adminOrders from '../services/adminOrder.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendFile, sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await adminOrders.listAdminOrders(req.query);
  sendSuccess(res, { data: items, meta });
});

export const exportFile = asyncHandler(async (req, res) => {
  sendFile(res, await adminOrders.exportAdminOrders(req.user, req.query));
});
