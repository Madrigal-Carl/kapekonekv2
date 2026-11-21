import * as cart from '../services/cart.service.js';
import { createUploadSignature } from '../services/upload.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await cart.getCart(req.user) });
});

export const add = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Added to your cart.', data: await cart.addItem(req.user, req.body) });
});

export const setQuantity = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await cart.setQuantity(req.user, req.params.productId, req.body.quantity) });
});

export const remove = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Removed from your cart.', data: await cart.removeItem(req.user, req.params.productId) });
});

export const clear = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Your cart is empty.', data: await cart.clearCart(req.user) });
});

export const uploadSignature = (req, res) => sendSuccess(res, { data: createUploadSignature(req.user, req.body.type) });
