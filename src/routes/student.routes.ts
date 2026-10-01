import { Router } from 'express';
import {
  register,
  login,
  logout,
  googleAuth,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  submitOnboarding,
  getAllStudents,
  getStudentById,
} from '../controllers/student.controller';
import { authenticateStudent } from '../middleware/studentAuth.middleware';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

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
