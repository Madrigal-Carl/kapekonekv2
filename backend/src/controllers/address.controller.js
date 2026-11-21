import * as addresses from '../services/address.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await addresses.listAddresses(req.user) });
});

export const create = asyncHandler(async (req, res) => {
  sendSuccess(res, { status: 201, message: 'Address saved.', data: await addresses.createAddress(req.user, req.body) });
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Address updated.', data: await addresses.updateAddress(req.user, req.params.id, req.body) });
});

export const remove = asyncHandler(async (req, res) => {
  await addresses.deleteAddress(req.user, req.params.id);
  sendSuccess(res, { message: 'Address deleted.' });
});

export const makeDefault = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Default address updated.', data: await addresses.setDefault(req.user, req.params.id) });
});
