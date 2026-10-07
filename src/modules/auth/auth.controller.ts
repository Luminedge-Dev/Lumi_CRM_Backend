import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http';
import { config } from '../../config/env';
import { authService } from './auth.service';
import {
  parseChangePassword,
  parseCheckUserEmail,
  parseForgetPassword,
  parseGoogleToken,
  parseLogin,
  parseRegister,
  parseResetPassword,
  parseSetPassword,
} from './auth.validation';

// Error body shapes are per-endpoint and unchanged: `{ message }` for the sign-in/registration
// flows, `{ success: false, message }` for change-password.

export const register = asyncHandler(
  async (req, res) => {
    res.status(201).json(await authService.register(parseRegister(req.body)));
  },
  { shape: 'message', fallbackMessage: 'Server error', logLabel: 'Register error:' },
);

export const googleLogin = asyncHandler(
  async (req, res) => {
    res.json(await authService.googleLogin(parseGoogleToken(req.body)));
  },
  { shape: 'message', fallbackMessage: 'Google authentication failed', logLabel: 'Google login error:' },
);

export const googleRegister = asyncHandler(
  async (req, res) => {
    const session = await authService.googleRegister(parseGoogleToken(req.body), req.body.role);
    res.status(201).json({ ...session, message: 'Account created successfully' });
  },
  { shape: 'message', fallbackMessage: 'Google registration failed', logLabel: 'Google register error:' },
);

export const login = asyncHandler(
  async (req, res) => {
    const result = await authService.login(parseLogin(req.body));
    if (result.kind === 'password-setup-required') {
      res.status(200).json({ message: 'PASSWORD_SETUP_REQUIRED', email: result.email });
      return;
    }
    const { kind: _kind, ...session } = result;
    res.json(session);
  },
  { shape: 'message', fallbackMessage: 'Server error', logLabel: 'Login error:' },
);

export const forgetPassword = asyncHandler(
  async (req, res) => {
    res.json({ message: await authService.forgetPassword(parseForgetPassword(req.body)) });
  },
  {
    shape: 'message',
    fallbackMessage: 'Failed to send password reset email. Please try again.',
    logLabel: 'Forget password error:',
  },
);

export const resetPassword = asyncHandler(
  async (req, res) => {
    const { token, password } = parseResetPassword(req.body);
    await authService.resetPassword(token, password);
    res.json({ message: 'Password has been reset successfully' });
  },
  { shape: 'message', fallbackMessage: 'Server error', logLabel: 'Reset password error:' },
);

export const setPassword = asyncHandler(
  async (req, res) => {
    const { token, password } = parseSetPassword(req.body);
    res.json(await authService.setPassword(token, password));
  },
  { shape: 'message', fallbackMessage: 'Server error', logLabel: 'Set password error:' },
);

export const changePassword = asyncHandler(
  async (req, res) => {
    const { currentPassword, newPassword } = parseChangePassword(req.body);
    await authService.changePassword(req.user?.userId, currentPassword, newPassword);
    res.json({ success: true, message: 'Password changed successfully' });
  },
  { shape: 'success', fallbackMessage: 'Failed to change password', logLabel: 'Error changing password:' },
);

export const checkUser = asyncHandler(async (req, res) => {
  res.json(await authService.checkUser(parseCheckUserEmail(req.body)));
});

export const logout = (_req: Request, res: Response): void => {
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
  });
  res.json({ success: true, message: 'Logged out successfully' });
};
