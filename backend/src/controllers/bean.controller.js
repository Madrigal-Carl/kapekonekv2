import * as beans from '../services/bean.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await beans.listListings(req.user, req.query);
  sendSuccess(res, { data: items, meta });
});

export const cap = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await beans.getCap(req.user, req.query) });
});

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await beans.getListing(req.user, req.params.id) });
});

export const create = asyncHandler(async (req, res) => {
  sendSuccess(res, { status: 201, message: 'Listing sent. Kaluppa will review it soon.', data: await beans.createListing(req.user, req.body) });
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Listing updated.', data: await beans.updateListing(req.user, req.params.id, req.body) });
});

const firstName = (listing) => listing.farmer.name.split(' ')[0];

export const approve = asyncHandler(async (req, res) => {
  const listing = await beans.approveListing(req.user, req.params.id);
  sendSuccess(res, { message: `${listing.listingNumber} approved. ${firstName(listing)} has 7 days to bring the beans.`, data: listing });
});

export const reject = asyncHandler(async (req, res) => {
  const listing = await beans.rejectListing(req.user, req.params.id, req.body);
  sendSuccess(res, { message: `${listing.listingNumber} rejected. The farmer was told your reason.`, data: listing });
});

export const complete = asyncHandler(async (req, res) => {
  const listing = await beans.completeListing(req.user, req.params.id, req.body);
  sendSuccess(res, { message: `${listing.listingNumber} completed.`, data: listing });
});

export const cancel = asyncHandler(async (req, res) => {
  const listing = await beans.cancelListing(req.user, req.params.id, req.body);
  sendSuccess(res, { message: `${listing.listingNumber} was cancelled.`, data: listing });
});
