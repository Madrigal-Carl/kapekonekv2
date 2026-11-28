import * as contact from '../services/contact.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const send = asyncHandler(async (req, res) => {
  sendSuccess(res, { status: 201, message: 'Message sent.', data: await contact.sendContactMessage(req.user ?? null, req.body) });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await contact.listMessages(req.query);
  sendSuccess(res, { data: items, meta });
});

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await contact.getMessage(req.params.id) });
});
