import express from 'express';
import { authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { requireStaff } from '../../middleware/authorization/roles.middleware';
import { getMyNotifications, markAllAsRead, markAsRead } from './notification.controller';

// Mounted at /api/notifications.
const router = express.Router();

// Notification recipients are User (staff) accounts, and the frontend only calls these with the
// staff accessToken; students never receive notifications here.
router.use(authenticateToken, requireStaff);

router.get('/', getMyNotifications);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);

export default router;
