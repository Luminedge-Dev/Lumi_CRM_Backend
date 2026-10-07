import express from 'express';
import { authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { authorizeRoles, requireStaff } from '../../middleware/authorization/roles.middleware';
import {
  changePassword,
  checkUser,
  forgetPassword,
  googleLogin,
  googleRegister,
  login,
  logout,
  register,
  resetPassword,
  setPassword,
} from './auth.controller';

// Mounted at /api/auth (together with users/user.routes.ts).
const router = express.Router();

router.post('/check-user', checkUser);
// Staff registration: admin-only, since BDM/Admin accounts are created by an admin.
router.post('/register', authenticateToken, authorizeRoles('admin'), register);
router.post('/google-register', authenticateToken, authorizeRoles('admin'), googleRegister);
router.post('/login', login);
router.post('/logout', logout);
router.post('/google', googleLogin);
router.post('/change-password', authenticateToken, requireStaff, changePassword);
router.post('/set-password', setPassword);
router.post('/forget-password', forgetPassword);
router.post('/reset-password', resetPassword);

export default router;
