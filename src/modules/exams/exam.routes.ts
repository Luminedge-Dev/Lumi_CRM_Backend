import express from 'express';
import { authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { authorizeRoles } from '../../middleware/authorization/roles.middleware';
import { createExam, deleteExam, getExam, getExams, updateExam } from './exam.controller';

// Mounted at /api/exams. Reading is open to any signed-in user; writing is admin-only.
const router = express.Router();

router.get('/', authenticateToken, getExams);
router.get('/:id', authenticateToken, getExam);
router.post('/', authenticateToken, authorizeRoles('admin'), createExam);
router.patch('/:id', authenticateToken, authorizeRoles('admin'), updateExam);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteExam);

export default router;
