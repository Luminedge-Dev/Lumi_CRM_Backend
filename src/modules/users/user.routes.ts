import express from 'express';
import { authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { authorizeRoles, requireStaff } from '../../middleware/authorization/roles.middleware';
import { deleteUser, getProfile, getUsers, getUserStats, updateProfile, updateUserRole } from './user.controller';

// Mounted at /api/auth (alongside auth.routes.ts), so the public paths are unchanged.
const router = express.Router();

// Staff-only: these read/write the User collection by the token's userId. Students have their own
// /api/student/profile and /api/student/profile/password.
router.get('/profile', authenticateToken, requireStaff, getProfile);
router.put('/profile', authenticateToken, requireStaff, updateProfile);
router.get('/stats', authenticateToken, requireStaff, getUserStats);

// User management
router.get('/users', authenticateToken, authorizeRoles('admin', 'bdm'), getUsers);
router.put('/users/:id/role', authenticateToken, authorizeRoles('admin'), updateUserRole);
router.delete('/users/:id', authenticateToken, authorizeRoles('admin'), deleteUser);

export default router;
