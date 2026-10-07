import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { requireStaff } from '../../middleware/authorization/roles.middleware';
import { getAvailableSchedules } from './schedule.controller';

// Mounted at /api/schedules.
const router = Router();

router.get('/', authenticateToken, requireStaff, getAvailableSchedules);

export default router;
