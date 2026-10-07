import { AppError } from '../../core/errors';
import type { IConversation } from '../../models/Conversation';
import { ChatActor, loadAccessibleConversation } from '../conversations/conversation.service';
import { conversationRepository } from '../conversations/conversation.repository';
import { messageRepository } from './message.repository';

export const MAX_MESSAGE_LENGTH = 5000;

export const validateMessageContent = (content: unknown): string => {
  if (typeof content !== 'string' || !content.trim()) throw AppError.badRequest('Message content is required');
  if (content.length > MAX_MESSAGE_LENGTH) {
    throw AppError.badRequest(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`);
  }
  return content;
};

/** The sender's display name comes from the conversation's own participant record, never from the client. */
const senderNameFor = (conversation: IConversation, actor: ChatActor): string =>
  conversation.participants.find((p) => p.participantId === actor.id)?.name || 'User';

export const messageService = {
  /** Participants may read; admins may also read any conversation (oversight, like the admin list). */
  async list(actor: ChatActor, conversationId: unknown, skip: number, limit: number) {
    const conversation = await loadAccessibleConversation(conversationId, actor, { allowAdminOversight: true });
    const messages = await messageRepository.listPage(conversation._id, skip, limit);
    return messages.reverse();
  },

  /** Validates, checks membership, and stores the message. The sender identity comes from `actor`, never the payload. */
  async post(actor: ChatActor, conversationId: unknown, rawContent: unknown) {
    const content = validateMessageContent(rawContent);
    const conversation = await loadAccessibleConversation(conversationId, actor);

    const message = await messageRepository.create({
      conversationId: conversation._id,
      senderType: actor.isStudent ? 'student' : 'staff',
      senderId: actor.id,
      senderName: senderNameFor(conversation, actor),
      content,
    });

    return { conversation, message };
  },

  /** REST send: store, then update the conversation's last-message preview. */
  async sendViaRest(actor: ChatActor, conversationId: unknown, rawContent: unknown) {
    const { conversation, message } = await messageService.post(actor, conversationId, rawContent);
    await conversationRepository.saveLastMessage(conversation, message.content);
    return message;
  },

  /** Socket send: store, update the preview, and return both for broadcasting. */
  async sendViaSocket(actor: ChatActor, conversationId: unknown, rawContent: unknown) {
    const { conversation, message } = await messageService.post(actor, conversationId, rawContent);
    await conversationRepository.updateLastMessage(conversation._id, message.content, actor.id);
    return { conversation, message };
  },

  async markConversationRead(actor: ChatActor, conversationId: unknown): Promise<void> {
    const conversation = await loadAccessibleConversation(conversationId, actor);
    await messageRepository.markRead(conversation._id, actor.id);
  },
};
