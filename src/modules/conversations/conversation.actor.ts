import { Request } from 'express';
import { ChatActor } from './conversation.service';

// authenticateStudent sets req.studentId; authenticateToken sets req.userId and req.user.role.
// This is the only place an HTTP request is turned into a chat actor.
export const chatActorFrom = (req: Request): ChatActor => {
  const studentId = (req as any).studentId;
  if (studentId) return { id: String(studentId), isStudent: true, role: 'student' };
  return { id: String((req as any).userId), isStudent: false, role: String(req.user?.role ?? '') };
};
