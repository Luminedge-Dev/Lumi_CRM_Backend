import { Router } from 'express';
import {
  uploadDocument,
  getMyDocuments,
  getStudentDocuments,
  requestDocument,
  reviewDocument,
} from '../controllers/document.controller';
import { studentAuthMiddleware } from '../middleware/studentAuth.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

const router = Router();

// Student
router.post('/student/documents/upload', studentAuthMiddleware, upload.single('file'), uploadDocument);
router.get('/student/documents', studentAuthMiddleware, getMyDocuments);

// Staff
router.post('/documents/upload', authMiddleware, upload.single('file'), uploadDocument);
router.get('/documents/:studentId', authMiddleware, getStudentDocuments);
router.post('/documents/request', authMiddleware, requestDocument);
router.patch('/documents/:id/review', authMiddleware, reviewDocument);

export default router;
