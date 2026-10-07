import express from 'express';
import { authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { authorizeRoles } from '../../middleware/authorization/roles.middleware';
import { getActivities } from './activity.controller';

// Mounted at /api/activities.
const router = express.Router();

router.get('/', authenticateToken, authorizeRoles('admin', 'bdm'), getActivities);

export default router;
