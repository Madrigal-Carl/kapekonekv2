import * as addresses from '../services/address.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

/** `If-Match: "3"` (or `3`) → 3; absent or malformed → undefined (no version check). */
const versionOf = (req) => {
  const match = /^(?:W\/)?"?(\d+)"?$/.exec(req.get('If-Match') ?? '');
  return match ? Number(match[1]) : undefined;
};

export const list = asyncHandler(async (req, res) => {
  const { items, version } = await addresses.listAddresses(req.user);
  sendSuccess(res, { data: items, meta: { version } });
});

export const create = asyncHandler(async (req, res) => {
  const { address, version } = await addresses.createAddress(req.user, req.body, versionOf(req));
  sendSuccess(res, { status: 201, message: 'Address saved.', data: address, meta: { version } });
});

export const update = asyncHandler(async (req, res) => {
  const { address, version } = await addresses.updateAddress(req.user, req.params.id, req.body, versionOf(req));
  sendSuccess(res, { message: 'Address updated.', data: address, meta: { version } });
});

export const remove = asyncHandler(async (req, res) => {
  const { version } = await addresses.deleteAddress(req.user, req.params.id, versionOf(req));
  sendSuccess(res, { message: 'Address deleted.', meta: { version } });
});

export const makeDefault = asyncHandler(async (req, res) => {
  const { address, version } = await addresses.setDefault(req.user, req.params.id, versionOf(req));
  sendSuccess(res, { message: 'Default address updated.', data: address, meta: { version } });
});
