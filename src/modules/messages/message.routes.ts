import { Router } from 'express';
import { authMiddleware, studentAuthMiddleware } from '../../middleware/auth/authenticate.middleware';
import { requireStaff } from '../../middleware/authorization/roles.middleware';
import { getMessages, sendMessage } from './message.controller';

// Mounted at /api.
const router = Router();

// Read
router.get('/conversations/:id/messages/student', studentAuthMiddleware, getMessages);
router.get('/conversations/:id/messages/staff', authMiddleware, requireStaff, getMessages);

// Send (either side)
router.post('/conversations/:id/messages/student', studentAuthMiddleware, sendMessage);
router.post('/conversations/:id/messages/staff', authMiddleware, requireStaff, sendMessage);

export default router;
