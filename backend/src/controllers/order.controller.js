import * as orders from '../services/order.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const place = asyncHandler(async (req, res) => {
  sendSuccess(res, { status: 201, message: 'Order placed.', data: await orders.placeOrder(req.user, req.body) });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await orders.listMyOrders(req.user, req.query);
  sendSuccess(res, { data: items, meta });
});

export const counts = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await orders.countMyOrders(req.user) });
});

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await orders.getOrderFor(req.user, req.params.id) });
});
