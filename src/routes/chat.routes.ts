import { Router } from 'express';
import {
  getConversations,
  getMessages,
  sendMessage,
  createConversation,
  getAllConversations,
} from '../controllers/chat.controller';
import { studentAuthMiddleware } from '../middleware/studentAuth.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Shared — both student and staff can list their conversations
router.get('/conversations/student', studentAuthMiddleware, getConversations);
router.get('/conversations/staff', authMiddleware, getConversations);

// Messages
router.get('/conversations/:id/messages/student', studentAuthMiddleware, getMessages);
router.get('/conversations/:id/messages/staff', authMiddleware, getMessages);

// Send (either side)
router.post('/conversations/:id/messages/student', studentAuthMiddleware, sendMessage);
router.post('/conversations/:id/messages/staff', authMiddleware, sendMessage);

// Create conversation + admin view
router.post('/conversations', authMiddleware, createConversation);
router.get('/admin/conversations', authMiddleware, getAllConversations);

export default router;
