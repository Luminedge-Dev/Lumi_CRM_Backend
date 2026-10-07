import { AppError } from '../../core/errors';
import { StudentProfileInput, StudentRegisterInput } from './student.types';

// Request parsing for the student endpoints; messages and statuses are the ones the student
// portal already handles.

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export const parseStudentRegister = (body: any): StudentRegisterInput => {
  const { name, email, password, phone } = body;
  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
    throw AppError.badRequest('Name, email and password are required');
  }
  if (password.length < 6) throw AppError.badRequest('Password must be at least 6 characters');
  return { name, email, password, phone };
};

// Non-string credentials are rejected up front (400) instead of failing inside bcrypt (500).
export const parseStudentLogin = (body: any): { email: string; password: string } => {
  const { email, password } = body;
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) throw AppError.badRequest('Email and password are required');
  return { email, password };
};

export const parseStudentGoogleToken = (body: any): string => {
  const { token } = body;
  if (!isNonEmptyString(token)) throw AppError.badRequest('Google token is required');
  return token;
};

export const parseStudentForgotEmail = (body: any): string => {
  const { email } = body;
  if (!isNonEmptyString(email)) throw AppError.badRequest('Email is required');
  return email;
};

export const parseStudentResetPassword = (body: any): { token: string; password: string } => {
  const { token, password } = body;
  if (!isNonEmptyString(token) || !isNonEmptyString(password)) throw AppError.badRequest('Token and password are required');
  if (password.length < 6) throw AppError.badRequest('Password must be at least 6 characters');
  return { token, password };
};

export const parseStudentChangePassword = (body: any): { currentPassword: string; newPassword: string } => {
  const { currentPassword, newPassword } = body;
  if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
    throw AppError.badRequest('Current and new password are required');
  }
  if (newPassword.length < 6) throw AppError.badRequest('New password must be at least 6 characters');
  return { currentPassword, newPassword };
};

/** Only these profile fields are student-editable. */
export const parseStudentProfile = (body: any): StudentProfileInput => {
  const { name, phone, address } = body;
  return { name, phone, address };
};

/** Onboarding answers: an explicit allowlist, plus the server-set completion flag. */
export const parseOnboarding = (body: any): Record<string, unknown> => {
  const {
    dateOfBirth, gender, nationality, nativeLanguage, currentAddress,
    passportNumber, passportExpiry, emergencyContact,
    academicRecords, englishTest,
    financialInfo,
    studyPreferences,
  } = body;

  return {
    dateOfBirth, gender, nationality, nativeLanguage, currentAddress,
    passportNumber, passportExpiry, emergencyContact,
    academicRecords, englishTest, financialInfo, studyPreferences,
    onboardingComplete: true,
  };
};
