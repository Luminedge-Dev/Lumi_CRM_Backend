import Message from '../../models/Message';

export const messageRepository = {
  create: (data: Record<string, any>) => Message.create(data),

  /** A page of messages, newest first (callers reverse for display). */
  listPage: (conversationId: unknown, skip: number, limit: number) =>
    Message.find({ conversationId }).sort({ createdAt: -1 }).skip(skip).limit(limit),

  markRead: (conversationId: unknown, readerId: string) =>
    Message.updateMany({ conversationId, readBy: { $ne: readerId } }, { $addToSet: { readBy: readerId } }),
};
