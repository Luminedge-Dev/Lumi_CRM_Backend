import express from 'express';
import { register, login, logout, googleLogin, googleRegister, getProfile, forgetPassword, resetPassword, getUsers, updateUserRole, deleteUser, updateProfile, changePassword, getUserStats, setPassword, checkUser } from '../controllers/auth.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/check-user', checkUser);
// Staff registration: admin-only — BDM/Admin accounts created by admin only
router.post('/register', authenticateToken, authorizeRoles('admin'), register);
router.post('/google-register', authenticateToken, authorizeRoles('admin'), googleRegister);
router.post('/login', login);
router.post('/logout', logout);
router.post('/google', googleLogin);
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.post('/change-password', authenticateToken, changePassword);
router.get('/stats', authenticateToken, getUserStats);
router.post('/set-password', setPassword);
router.post('/forget-password', forgetPassword);
router.post('/reset-password', resetPassword);

// User management routes (admin only)
router.get('/users', authenticateToken, authorizeRoles('admin', 'bdm'), getUsers);
router.put('/users/:id/role', authenticateToken, authorizeRoles('admin'), updateUserRole);
router.delete('/users/:id', authenticateToken, authorizeRoles('admin'), deleteUser);

export default router;
