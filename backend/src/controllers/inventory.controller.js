import * as inventory from '../services/inventory.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await inventory.listInventory(req.query);
  sendSuccess(res, { data: items, meta });
});

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await inventory.getInventoryProduct(req.params.id) });
});

export const create = asyncHandler(async (req, res) => {
  sendSuccess(res, { status: 201, message: 'Product added.', data: await inventory.createInventoryProduct(req.user, req.body) });
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Product saved.', data: await inventory.updateInventoryProduct(req.user, req.params.id, req.body) });
});

export const archive = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Product archived.', data: await inventory.setArchived(req.user, req.params.id, true) });
});

export const restore = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Product restored.', data: await inventory.setArchived(req.user, req.params.id, false) });
});
