import express from 'express';
import { authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { authorizeRoles } from '../../middleware/authorization/roles.middleware';
import { getBDMReport, getBDMTaskStatus } from './report.controller';

// Mounted at /api/reports.
const router = express.Router();

router.get('/bdm', authenticateToken, authorizeRoles('admin', 'bdm'), getBDMReport);
router.get('/task-status', authenticateToken, authorizeRoles('admin', 'bdm'), getBDMTaskStatus);

export default router;
