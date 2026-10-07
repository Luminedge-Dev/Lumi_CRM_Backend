import { asyncHandler, HandlerOptions } from '../../core/http';
import { chatActorFrom } from './conversation.actor';
import { conversationService } from './conversation.service';

// `{ success: false, message }` on failure. Membership/validation problems carry their own safe
// message; an unexpected failure is a 500 with a fixed message.
const opts: HandlerOptions = {
  shape: 'success',
  fallbackMessage: 'Internal server error',
  logLabel: 'chat controller error:',
  exposeValidation: true,
  validationStatus: 500,
};

export const getConversations = asyncHandler(async (req, res) => {
  res.json({ success: true, conversations: await conversationService.listForParticipant(chatActorFrom(req)) });
}, opts);

export const createConversation = asyncHandler(async (req, res) => {
  const { participants, applicationId, title } = req.body ?? {};
  const conversation = await conversationService.create({ participants, applicationId, title });
  res.status(201).json({ success: true, conversation });
}, opts);

export const getAllConversations = asyncHandler(async (_req, res) => {
  res.json({ success: true, conversations: await conversationService.listAllRecent() });
}, opts);
