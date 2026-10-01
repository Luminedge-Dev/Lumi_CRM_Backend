import { Router } from 'express';
import { getAvailableSchedules } from '../controllers/schedules.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken, getAvailableSchedules);

export default router;
