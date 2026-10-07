import { Router } from 'express';
import { authMiddleware, studentAuthMiddleware } from '../../middleware/auth/authenticate.middleware';
import { authorizeRoles, requireStaff } from '../../middleware/authorization/roles.middleware';
import { createConversation, getAllConversations, getConversations } from './conversation.controller';

// Mounted at /api.
const router = Router();

// Both student and staff can list their conversations
router.get('/conversations/student', studentAuthMiddleware, getConversations);
router.get('/conversations/staff', authMiddleware, requireStaff, getConversations);

// Create conversation + admin view
router.post('/conversations', authMiddleware, authorizeRoles('admin'), createConversation);
router.get('/admin/conversations', authMiddleware, authorizeRoles('admin'), getAllConversations);

export default router;
