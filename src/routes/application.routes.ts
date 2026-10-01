import { Router } from 'express';
import {
  submitApplication,
  getMyApplications,
  getAllApplications,
  assignStaff,
  updateApplicationStatus,
  getApplicationById,
  getStaffApplications,
} from '../controllers/application.controller';
import { studentAuthMiddleware } from '../middleware/studentAuth.middleware';
import { authMiddleware, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// Student routes
router.post('/student/applications', studentAuthMiddleware, submitApplication);
router.get('/student/applications', studentAuthMiddleware, getMyApplications);

// Staff routes
router.get('/applications', authMiddleware, authorizeRoles('admin'), getAllApplications);
router.get('/applications/my', authMiddleware, getStaffApplications);
router.get('/applications/:id', authMiddleware, getApplicationById);
router.patch('/applications/:id/assign', authMiddleware, authorizeRoles('admin'), assignStaff);
router.patch('/applications/:id/status', authMiddleware, authorizeRoles('admin', 'bdm'), updateApplicationStatus);

export default router;
