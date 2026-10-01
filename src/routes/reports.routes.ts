import express from 'express';
import { getBDMReport, getBDMTaskStatus } from '../controllers/reports.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/bdm', authenticateToken, authorizeRoles('admin', 'bdm'), getBDMReport);
router.get('/task-status', authenticateToken, authorizeRoles('admin', 'bdm'), getBDMTaskStatus);

export default router;
