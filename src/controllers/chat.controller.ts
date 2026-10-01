import { Request, Response } from 'express';
import Conversation from '../models/Conversation';
import Message from '../models/Message';

export const getConversations = async (req: Request, res: Response) => {
  try {
    const isStudent = !!(req as any).studentId;
    const userId = isStudent ? String((req as any).studentId) : String((req as any).userId);

    const convs = await Conversation.find({
      'participants.participantId': userId,
    }).sort({ lastMessageAt: -1, updatedAt: -1 });

    res.json({ success: true, conversations: convs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const messages = await Message.find({ conversationId: id })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({ success: true, messages: messages.reverse() });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const isStudent = !!(req as any).studentId;
    const senderId = isStudent ? String((req as any).studentId) : String((req as any).userId);
    const senderName = (req as any).userName || 'User';

    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });

    const msg = await Message.create({
      conversationId: id,
      senderType: isStudent ? 'student' : 'staff',
      senderId,
      senderName,
      content,
    });

    conv.lastMessage = content;
    conv.lastMessageAt = new Date();
    await conv.save();

    // Socket.IO emit is handled in socket.service.ts; here we just persist
    res.status(201).json({ success: true, message: msg });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createConversation = async (req: Request, res: Response) => {
  try {
    const { participants, applicationId, title } = req.body;
    const conv = await Conversation.create({ participants, applicationId, title });
    res.status(201).json({ success: true, conversation: conv });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllConversations = async (_req: Request, res: Response) => {
  try {
    const convs = await Conversation.find().sort({ lastMessageAt: -1 }).limit(100);
    res.json({ success: true, conversations: convs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
