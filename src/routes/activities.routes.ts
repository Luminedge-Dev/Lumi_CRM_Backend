import express from 'express';
import { getActivities } from '../controllers/activities.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/', authenticateToken, authorizeRoles('admin', 'bdm'), getActivities);

export default router;
