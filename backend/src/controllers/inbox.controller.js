import * as inbox from '../services/inbox.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await inbox.listConversations(req.user, req.query) });
});

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await inbox.getConversation(req.user, req.params.id) });
});

export const direct = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await inbox.openDirect(req.user, req.body) });
});

export const people = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await inbox.listPeople(req.user, req.query) });
});

export const messages = asyncHandler(async (req, res) => {
  const { items, meta } = await inbox.listMessages(req.user, req.params.id, req.query);
  sendSuccess(res, { data: items, meta });
});

export const send = asyncHandler(async (req, res) => {
  sendSuccess(res, { status: 201, data: await inbox.sendMessage(req.user, req.params.id, req.body) });
});

export const read = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await inbox.markConversationRead(req.user, req.params.id) });
});

export const edit = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Message edited.', data: await inbox.editMessage(req.user, req.params.id, req.body) });
});

export const remove = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Message deleted.', data: await inbox.deleteMessage(req.user, req.params.id, req.query) });
});
