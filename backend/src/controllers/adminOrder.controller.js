import * as adminOrders from '../services/adminOrder.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await adminOrders.listAdminOrders(req.query);
  sendSuccess(res, { data: items, meta });
});

export const exportCsv = asyncHandler(async (req, res) => {
  res.attachment('orders.csv').type('text/csv; charset=utf-8').send(await adminOrders.exportAdminOrders(req.query));
});
