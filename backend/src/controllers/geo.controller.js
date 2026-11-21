import { quoteForOwnAddress } from '../services/address.service.js';
import { quoteForPoint } from '../services/deliveryQuote.service.js';
import * as geo from '../services/geo.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const reverse = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await geo.reverse(req.query) });
});

export const search = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await geo.search(req.query.q) });
});

export const quote = asyncHandler(async (req, res) => {
  const { addressId, lat, lng } = req.query;
  sendSuccess(res, { data: await (addressId ? quoteForOwnAddress(req.user, addressId) : quoteForPoint({ lat, lng })) });
});
