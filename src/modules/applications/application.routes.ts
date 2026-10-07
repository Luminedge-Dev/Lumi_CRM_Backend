import { Router } from 'express';
import { authMiddleware, studentAuthMiddleware } from '../../middleware/auth/authenticate.middleware';
import { authorizeRoles, requireStaff } from '../../middleware/authorization/roles.middleware';
import {
  assignStaff,
  getAllApplications,
  getApplicationById,
  getMyApplications,
  getStaffApplications,
  submitApplication,
  updateApplicationStatus,
} from './application.controller';

// Mounted at /api.
const router = Router();

// Student routes
router.post('/student/applications', studentAuthMiddleware, submitApplication);
router.get('/student/applications', studentAuthMiddleware, getMyApplications);

// Staff routes
router.get('/applications', authMiddleware, authorizeRoles('admin'), getAllApplications);
router.get('/applications/my', authMiddleware, requireStaff, getStaffApplications);
router.get('/applications/:id', authMiddleware, requireStaff, getApplicationById);
router.patch('/applications/:id/assign', authMiddleware, authorizeRoles('admin'), assignStaff);
router.patch('/applications/:id/status', authMiddleware, authorizeRoles('admin', 'bdm'), updateApplicationStatus);

export default router;
