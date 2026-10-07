import Conversation, { IConversation } from '../../models/Conversation';

export const conversationRepository = {
  findById: (id: unknown) => Conversation.findById(id),

  /** An existing conversation between exactly these two participants about one application. */
  findForParticipantsAndApplication: (participantIds: string[], applicationId: unknown) =>
    Conversation.findOne({
      'participants.participantId': { $all: participantIds },
      applicationId,
    }),

  listForParticipant: (participantId: string) =>
    Conversation.find({ 'participants.participantId': participantId }).sort({ lastMessageAt: -1, updatedAt: -1 }),

  /** Admin oversight list: the most recent 100 conversations. */
  listRecent: (limit: number) => Conversation.find().sort({ lastMessageAt: -1 }).limit(limit),

  create: (data: Record<string, any>) => Conversation.create(data),

  /** REST path: persists the last-message preview on the loaded document. */
  saveLastMessage: (conversation: IConversation, content: string) => {
    conversation.lastMessage = content;
    conversation.lastMessageAt = new Date();
    return conversation.save();
  },

  /** Socket path: updates the preview in place (and makes sure the sender has an unread counter entry). */
  updateLastMessage: (id: unknown, content: string, senderId: string) =>
    Conversation.findByIdAndUpdate(id, {
      lastMessage: content,
      lastMessageAt: new Date(),
      $inc: { [`unreadCounts.${senderId}`]: 0 },
    }),
};
