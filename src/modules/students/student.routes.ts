import { Router } from 'express';
import { authenticateStudent, authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { authorizeRoles } from '../../middleware/authorization/roles.middleware';
import {
  changePassword,
  forgotPassword,
  getAllStudents,
  getProfile,
  getStudentById,
  googleAuth,
  login,
  logout,
  register,
  resetPassword,
  submitOnboarding,
  updateProfile,
} from './student.controller';

// Mounted at /api/student.
const router = Router();

// Public routes
router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/auth/logout', logout);
router.post('/auth/google', googleAuth);
router.post('/auth/forgot-password', forgotPassword);
router.post('/auth/reset-password', resetPassword);

// Student protected routes
router.get('/profile', authenticateStudent, getProfile);
router.put('/profile', authenticateStudent, updateProfile);
router.put('/profile/password', authenticateStudent, changePassword);
router.put('/onboarding', authenticateStudent, submitOnboarding);

// Staff routes for student management
router.get('/students', authenticateToken, authorizeRoles('admin', 'bdm'), getAllStudents);
router.get('/students/:id', authenticateToken, authorizeRoles('admin', 'bdm'), getStudentById);

export default router;
