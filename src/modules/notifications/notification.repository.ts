import Notification from '../../models/Notification';

export const notificationRepository = {
  create: (data: Record<string, any>) => Notification.create(data),

  listForRecipient: (filter: Record<string, any>, limit: number) =>
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit),

  countUnread: (recipient: unknown) => Notification.countDocuments({ recipient, isRead: false }),

  /** Marks one notification read, but only if it belongs to the recipient. */
  markRead: (id: string, recipient: unknown) =>
    Notification.findOneAndUpdate({ _id: id, recipient }, { isRead: true }, { new: true }),

  markAllRead: (recipient: unknown) => Notification.updateMany({ recipient, isRead: false }, { isRead: true }),
};
