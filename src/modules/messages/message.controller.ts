import { asyncHandler, HandlerOptions } from '../../core/http';
import { chatActorFrom } from '../conversations/conversation.actor';
import { parsePagination } from '../../shared/validators/request';
import { messageService } from './message.service';

const opts: HandlerOptions = {
  shape: 'success',
  fallbackMessage: 'Internal server error',
  logLabel: 'chat controller error:',
  exposeValidation: true,
  validationStatus: 500,
};

export const getMessages = asyncHandler(async (req, res) => {
  const { limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  const messages = await messageService.list(chatActorFrom(req), req.params.id, skip, limit);
  res.json({ success: true, messages });
}, opts);

export const sendMessage = asyncHandler(async (req, res) => {
  // Socket.IO delivery is handled by the socket integration; REST only persists.
  const message = await messageService.sendViaRest(chatActorFrom(req), req.params.id, req.body?.content);
  res.status(201).json({ success: true, message });
}, opts);
