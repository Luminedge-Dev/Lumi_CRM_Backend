import { Router } from 'express';
import { authMiddleware, studentAuthMiddleware } from '../../middleware/auth/authenticate.middleware';
import { requireStaff } from '../../middleware/authorization/roles.middleware';
import { upload } from '../../middleware/uploads/upload.middleware';
import { getMyDocuments, getStudentDocuments, requestDocument, reviewDocument, uploadDocument } from './document.controller';

// Mounted at /api.
const router = Router();

// Student
router.post('/student/documents/upload', studentAuthMiddleware, upload.single('file'), uploadDocument);
router.get('/student/documents', studentAuthMiddleware, getMyDocuments);

// Staff
router.post('/documents/upload', authMiddleware, requireStaff, upload.single('file'), uploadDocument);
router.get('/documents/:studentId', authMiddleware, requireStaff, getStudentDocuments);
router.post('/documents/request', authMiddleware, requireStaff, requestDocument);
router.patch('/documents/:id/review', authMiddleware, requireStaff, reviewDocument);

export default router;
