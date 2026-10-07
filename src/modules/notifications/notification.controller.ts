import { asyncHandler } from '../../core/http';
import { notificationService } from './notification.service';

// `{ success: false, message }` on failure with fixed messages.

export const getMyNotifications = asyncHandler(
  async (req, res) => {
    const { limit, unreadOnly } = req.query;
    // A falsy/invalid limit (missing, '0', 'abc', negative) must fall back to the default, not
    // reach Mongoose as 0 or NaN: .limit(0) means "no limit" and returns every matching document.
    const parsedLimit = parseInt(limit as string, 10);
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 50;
    const { notifications, totalUnread } = await notificationService.listForUser(
      req.user?.userId,
      safeLimit,
      unreadOnly === 'true',
    );

    res.json({ success: true, data: notifications, meta: { unreadCount: totalUnread } });
  },
  { shape: 'success', fallbackMessage: 'Failed to fetch notifications', logLabel: 'Error fetching notifications:' },
);

export const markAsRead = asyncHandler(
  async (req, res) => {
    res.json({ success: true, data: await notificationService.markAsRead(req.params.id, req.user?.userId) });
  },
  { shape: 'success', fallbackMessage: 'Failed to update notification', logLabel: 'Error marking notification as read:' },
);

export const markAllAsRead = asyncHandler(
  async (req, res) => {
    await notificationService.markAllAsRead(req.user?.userId);
    res.json({ success: true, message: 'All notifications marked as read' });
  },
  { shape: 'success', fallbackMessage: 'Failed to update notifications', logLabel: 'Error marking all as read:' },
);
