import express from 'express';
import { getExams, getExam, createExam, updateExam, deleteExam } from '../controllers/exams.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/', authenticateToken, getExams);
router.get('/:id', authenticateToken, getExam);
router.post('/', authenticateToken, authorizeRoles('admin'), createExam);
router.patch('/:id', authenticateToken, authorizeRoles('admin'), updateExam);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteExam);

export default router;
