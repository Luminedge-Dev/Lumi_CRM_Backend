import { found } from '../../core/errors';
import { socketService } from '../../integrations/socket/socket.service';
import { forwardNotificationToSocketServer } from '../../integrations/socket/socket-bridge.service';
import { userRepository } from '../users/user.repository';
import { notificationRepository } from './notification.repository';

export type NotificationType = 'info' | 'success' | 'warning';

/** Saves a notification, pushes it to the recipient's live socket, and forwards it to the socket host when the API runs separately. */
export const createAndEmitNotification = async (
  recipientId: string,
  title: string,
  message: string,
  type: NotificationType = 'info',
  link?: string,
) => {
  try {
    // 1. Save to MongoDB
    const newNotification = await notificationRepository.create({
      recipient: recipientId,
      title,
      message,
      type,
      link,
      isRead: false,
    });

    // 2. Emit via WebSockets directly to the user
    socketService.emitToUser(recipientId, 'new-notification', newNotification);

    // 3. Forward to a dedicated socket host when the API runs separately from the websocket
    //    server. This keeps live push working on serverless API deployments such as Vercel.
    const notificationForBridge: any =
      typeof newNotification.toObject === 'function' ? newNotification.toObject() : newNotification;

    void forwardNotificationToSocketServer({
      recipientId,
      notification: {
        ...notificationForBridge,
        _id: notificationForBridge._id?.toString?.() ?? String(notificationForBridge._id),
        recipient: notificationForBridge.recipient?.toString?.() ?? String(notificationForBridge.recipient),
      },
    });

    return newNotification;
  } catch (error) {
    console.error('Failed to create and emit notification:', error);
    throw error;
  }
};

export const createAndEmitToAdmins = async (title: string, message: string, type: NotificationType = 'info', link?: string) =>
  createAndEmitToRoles(['admin'], title, message, type, undefined, link);

/** Notifies every active user holding one of the roles. Never throws: a failed fan-out must not fail the caller. */
export const createAndEmitToRoles = async (
  roles: string[],
  title: string,
  message: string,
  type: NotificationType = 'info',
  excludeUserId?: string,
  link?: string,
) => {
  try {
    const users = await userRepository.findActiveIdsByRoles(roles, excludeUserId);

    await Promise.all(users.map((user) => createAndEmitNotification(user._id.toString(), title, message, type, link)));
  } catch (error) {
    console.error('Failed to create and emit to roles:', error);
  }
};

export const notificationService = {
  async listForUser(userId: unknown, limit: number, unreadOnly: boolean) {
    const filter: Record<string, any> = { recipient: userId };
    if (unreadOnly) filter.isRead = false;

    const notifications = await notificationRepository.listForRecipient(filter, limit);
    const totalUnread = await notificationRepository.countUnread(userId);
    return { notifications, totalUnread };
  },

  async markAsRead(id: string, userId: unknown) {
    return found(await notificationRepository.markRead(id, userId), 'Notification not found');
  },

  async markAllAsRead(userId: unknown): Promise<void> {
    await notificationRepository.markAllRead(userId);
  },
};
