import { Router } from 'express';
import { getMyMilestones, getStudentMilestones, updateMilestone } from '../controllers/milestone.controller';
import { studentAuthMiddleware } from '../middleware/studentAuth.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/student/milestones', studentAuthMiddleware, getMyMilestones);
router.get('/milestones/:studentId', authMiddleware, getStudentMilestones);
router.patch('/milestones/:id', authMiddleware, updateMilestone);

export default router;
