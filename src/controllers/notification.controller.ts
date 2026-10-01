import { Request, Response } from 'express';
import Notification from '../models/Notification';

// Get notifications for the authenticated user
export const getMyNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const { limit = '50', unreadOnly } = req.query;

        const filter: any = { recipient: userId };
        if (unreadOnly === 'true') {
            filter.isRead = false;
        }

        const notifications = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit as string));

        const totalUnread = await Notification.countDocuments({ recipient: userId, isRead: false });

        res.json({
            success: true,
            data: notifications,
            meta: {
                unreadCount: totalUnread
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
};

// Mark a single notification as read
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipient: userId },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            res.status(404).json({ success: false, message: 'Notification not found' });
            return;
        }

        res.json({ success: true, data: notification });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, message: 'Failed to update notification' });
    }
};

// Mark all notifications as read
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;

        await Notification.updateMany(
            { recipient: userId, isRead: false },
            { isRead: true }
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ success: false, message: 'Failed to update notifications' });
    }
};
