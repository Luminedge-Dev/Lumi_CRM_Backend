import { AppError } from '../../core/errors';
import { isStaffRole, StaffRole } from '../../shared/constants/roles';
import { LoginInput, RegisterInput } from './auth.types';

// Request parsing for the auth endpoints. Messages and statuses are the ones the frontend already
// handles; each function selects only the fields the endpoint accepts.

// Same minimum the frontend forms enforce.
const MIN_PASSWORD_LENGTH = 6;

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const assertStaffRole = (role: unknown): void => {
  if (!isStaffRole(role)) throw AppError.badRequest('Invalid role. Allowed: admin, bdm');
};

export const parseRegister = (body: any): RegisterInput => {
  const { name, email, password, role = 'bdm' } = body;
  assertStaffRole(role);
  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
    throw AppError.badRequest('Name, email and password are required');
  }
  if (password.length < MIN_PASSWORD_LENGTH) throw AppError.badRequest('Password must be at least 6 characters');
  return { name, email, password, role: role as StaffRole };
};

export const parseLogin = (body: any): LoginInput => {
  const { email, password } = body;
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) throw AppError.badRequest('Email and password are required');
  return { email, password };
};

export const parseGoogleToken = (body: any): string => body.token;

export const parseForgetPassword = (body: any): string => {
  const { email } = body;
  if (!isNonEmptyString(email)) throw AppError.badRequest('Email is required');
  return email;
};

export const parseResetPassword = (body: any): { token: string; password: string } => {
  const { token, password } = body;
  if (!isNonEmptyString(token) || !isNonEmptyString(password)) throw AppError.badRequest('Token and password are required');
  if (password.length < MIN_PASSWORD_LENGTH) throw AppError.badRequest('Password must be at least 6 characters');
  return { token, password };
};

export const parseSetPassword = (body: any): { token: string; password: string } => {
  const { token, password } = body;
  if (!isNonEmptyString(token) || !isNonEmptyString(password)) throw AppError.badRequest('Reset token and password are required');
  if (password.length < MIN_PASSWORD_LENGTH) throw AppError.badRequest('Password must be at least 6 characters');
  return { token, password };
};

export const parseChangePassword = (body: any): { currentPassword: string; newPassword: string } => {
  const { currentPassword, newPassword } = body;
  if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
    throw AppError.badRequest('Current password and new password are required');
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) throw AppError.badRequest('New password must be at least 6 characters');
  return { currentPassword, newPassword };
};

export const parseCheckUserEmail = (body: any): string | undefined =>
  typeof body.email === 'string' ? body.email : undefined;
