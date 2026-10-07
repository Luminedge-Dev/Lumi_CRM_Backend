import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http';
import { config } from '../../config/env';
import { studentService } from './student.service';
import { studentAuthService } from './studentAuth.service';
import {
  parseOnboarding,
  parseStudentChangePassword,
  parseStudentForgotEmail,
  parseStudentGoogleToken,
  parseStudentLogin,
  parseStudentProfile,
  parseStudentRegister,
  parseStudentResetPassword,
} from './student.validation';

// The student portal reads `{ message }` on failure.
const opts = (fallbackMessage: string, logLabel: string) => ({ shape: 'message' as const, fallbackMessage, logLabel });

const studentIdOf = (req: Request) => (req as any).student?.studentId;

// ── student authentication (public) ──────────────────────────────────────────

export const register = asyncHandler(
  async (req, res) => {
    const session = await studentAuthService.register(parseStudentRegister(req.body));
    res.status(201).json({ success: true, message: 'Account created successfully.', ...session });
  },
  opts('Server error', 'Student register error:'),
);

export const login = asyncHandler(
  async (req, res) => {
    const { email, password } = parseStudentLogin(req.body);
    res.json(await studentAuthService.login(email, password));
  },
  opts('Server error', 'Student login error:'),
);

export const googleAuth = asyncHandler(
  async (req, res) => {
    res.json(await studentAuthService.googleAuth(parseStudentGoogleToken(req.body)));
  },
  opts('Google authentication failed', 'Student Google auth error:'),
);

export const forgotPassword = asyncHandler(
  async (req, res) => {
    res.json({ message: await studentAuthService.forgotPassword(parseStudentForgotEmail(req.body)) });
  },
  opts('Server error', 'Student forgotPassword error:'),
);

export const resetPassword = asyncHandler(
  async (req, res) => {
    const { token, password } = parseStudentResetPassword(req.body);
    await studentAuthService.resetPassword(token, password);
    res.json({ message: 'Password reset successfully' });
  },
  opts('Server error', 'Student resetPassword error:'),
);

export const logout = (_req: Request, res: Response): void => {
  res.clearCookie('studentToken', {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

// ── student self-service (student token) ─────────────────────────────────────

export const getProfile = asyncHandler(
  async (req, res) => {
    res.json(await studentService.getProfile(studentIdOf(req)));
  },
  opts('Server error', 'Student getProfile error:'),
);

export const updateProfile = asyncHandler(
  async (req, res) => {
    const student = await studentService.updateProfile(studentIdOf(req), parseStudentProfile(req.body));
    res.json({ success: true, student });
  },
  opts('Server error', 'Student updateProfile error:'),
);

export const changePassword = asyncHandler(
  async (req, res) => {
    const { currentPassword, newPassword } = parseStudentChangePassword(req.body);
    await studentAuthService.changePassword(studentIdOf(req), currentPassword, newPassword);
    res.json({ success: true, message: 'Password changed successfully' });
  },
  opts('Server error', 'Student changePassword error:'),
);

export const submitOnboarding = asyncHandler(
  async (req, res) => {
    const studentId = (req as any).studentId || studentIdOf(req);
    const student = await studentService.submitOnboarding(studentId, parseOnboarding(req.body));
    res.json({ success: true, student });
  },
  opts('Server error', 'Student submitOnboarding error:'),
);

// ── staff views of students ──────────────────────────────────────────────────

export const getAllStudents = asyncHandler(
  async (_req, res) => {
    res.json({ success: true, students: await studentService.listStudents() });
  },
  opts('Server error', 'Error fetching students:'),
);

export const getStudentById = asyncHandler(
  async (req, res) => {
    res.json({ success: true, student: await studentService.getStudent(req.params.id) });
  },
  opts('Server error', 'Error fetching student:'),
);
