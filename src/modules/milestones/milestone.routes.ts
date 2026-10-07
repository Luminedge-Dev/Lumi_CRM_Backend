import { Router } from 'express';
import { authMiddleware, studentAuthMiddleware } from '../../middleware/auth/authenticate.middleware';
import { requireStaff } from '../../middleware/authorization/roles.middleware';
import { getMyMilestones, getStudentMilestones, updateMilestone } from './milestone.controller';

// Mounted at /api.
const router = Router();

router.get('/student/milestones', studentAuthMiddleware, getMyMilestones);
router.get('/milestones/:studentId', authMiddleware, requireStaff, getStudentMilestones);
router.patch('/milestones/:id', authMiddleware, requireStaff, updateMilestone);

export default router;
